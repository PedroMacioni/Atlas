"""
Opções próximas: Google Places com OpenStreetMap de reserva e tempo de carro
pelo OSRM. Nenhuma rede — os três serviços são interceptados por `respx`.
"""

from datetime import date
from urllib.parse import parse_qs

import httpx
import pytest
import respx

from app.core.errors import NearbyUnavailableError
from app.providers.nearby import GOOGLE_URL, GooglePlacesProvider, OverpassProvider
from app.providers.osrm import OsrmRouteProvider
from app.providers.tomtom import TomTomNearbyProvider
from app.schemas.coordinate import Coordinate
from app.schemas.nearby import NearbyCategory
from app.services.daily_budget import DailyBudget
from app.services.nearby_service import NearbyService, NearbySource

OVERPASS = "https://overpass.test/api/interpreter"
OSRM_TABLE = {"url__startswith": "https://osrm.test/table/v1/driving/"}
ORIGIN = Coordinate(latitude=-22.8616, longitude=-47.0452)

GOOGLE_OK = {
    "places": [
        {
            "id": "perto-em-linha-reta",
            "displayName": {"text": "Posto do Outro Lado", "languageCode": "pt"},
            "shortFormattedAddress": "Rod. D. Pedro I",
            "location": {"latitude": -22.8620, "longitude": -47.0455},
            "rating": 3.9,
            "userRatingCount": 120,
            "businessStatus": "OPERATIONAL",
        },
        {
            "id": "rapido-de-carro",
            "displayName": {"text": "Posto Taquaral", "languageCode": "pt"},
            "shortFormattedAddress": "Av. Heitor Penteado, 100",
            "location": {"latitude": -22.8700, "longitude": -47.0500},
            "rating": 4.6,
            "userRatingCount": 830,
            "businessStatus": "OPERATIONAL",
        },
        {
            "id": "fechado",
            "displayName": {"text": "Posto Fechado"},
            "location": {"latitude": -22.8630, "longitude": -47.0460},
            "businessStatus": "CLOSED_PERMANENTLY",
        },
    ]
}

# Origem na coluna 0; o "perto em linha reta" leva 9 min, o outro 3 min.
TABLE_OK = {
    "code": "Ok",
    "durations": [[0, 540, 180]],
    "distances": [[0, 4200, 1500]],
}

OVERPASS_OK = {
    "elements": [
        {
            "type": "node",
            "id": 1,
            "lat": -22.8650,
            "lon": -47.0470,
            "tags": {"name": "Hospital Municipal", "amenity": "hospital"},
        },
        {
            "type": "way",
            "id": 2,
            "center": {"lat": -22.8700, "lon": -47.0600},
            "tags": {"name": "Hospital Regional", "addr:street": "Rua A", "addr:housenumber": "10"},
        },
        {"type": "node", "id": 3, "lat": -22.86, "lon": -47.04, "tags": {"amenity": "hospital"}},
    ]
}


@pytest.fixture
async def client():
    async with httpx.AsyncClient() as http:
        yield http


def build(client, *, google=True, tomtom=False, limit=30):
    sources = []
    if google:
        sources.append(
            NearbySource(
                GooglePlacesProvider(client, "chave-de-teste"), "Google Places", DailyBudget(limit)
            )
        )
    if tomtom:
        sources.append(
            NearbySource(TomTomNearbyProvider(client, "chave-tomtom"), "TomTom", DailyBudget(30))
        )
    return NearbyService(
        sources=sources,
        fallback=OverpassProvider(client, OVERPASS),
        router=OsrmRouteProvider(client, "https://osrm.test"),
    )


@respx.mock
async def test_google_com_nota_ordenado_pelo_tempo_de_carro(client):
    google = respx.post(GOOGLE_URL).mock(return_value=httpx.Response(200, json=GOOGLE_OK))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(200, json=TABLE_OK))

    result = await build(client).search(NearbyCategory.POSTO, ORIGIN)

    assert result.source == "google-places"
    assert result.fallback_reason is None
    # O fechado some; o mais rápido de carro vem primeiro, mesmo mais longe.
    assert [p.name for p in result.places] == ["Posto Taquaral", "Posto do Outro Lado"]
    first = result.places[0]
    assert first.rating == 4.6 and first.rating_count == 830
    assert first.duration_seconds == 180 and first.by_road

    request = google.calls.last.request
    assert request.headers["X-Goog-Api-Key"] == "chave-de-teste"
    # O field mask é o que decide o custo: só o que a tela usa.
    assert "places.rating" in request.headers["X-Goog-FieldMask"]
    assert "places.reviews" not in request.headers["X-Goog-FieldMask"]


@respx.mock
async def test_sem_chave_usa_openstreetmap_sem_nota(client):
    overpass = respx.post(OVERPASS).mock(return_value=httpx.Response(200, json=OVERPASS_OK))
    respx.get(**OSRM_TABLE).mock(
        return_value=httpx.Response(
            200, json={"code": "Ok", "durations": [[0, 300, 600]], "distances": [[0, 2000, 5000]]}
        )
    )

    result = await build(client, google=False).search(NearbyCategory.HOSPITAL, ORIGIN)

    assert result.source == "openstreetmap"
    assert result.fallback_reason == "nenhuma fonte com chave configurada"
    assert [p.name for p in result.places] == ["Hospital Municipal", "Hospital Regional"]
    assert result.places[0].rating is None
    assert result.places[1].address == "Rua A, 10"
    sent = parse_qs(overpass.calls.last.request.content.decode())["data"][0]
    assert '["amenity"="hospital"]' in sent


@respx.mock
async def test_google_falhando_cai_na_reserva(client):
    respx.post(GOOGLE_URL).mock(return_value=httpx.Response(403, text="API not enabled"))
    respx.post(OVERPASS).mock(return_value=httpx.Response(200, json=OVERPASS_OK))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(500))

    result = await build(client).search(NearbyCategory.HOSPITAL, ORIGIN)

    assert result.source == "openstreetmap"
    assert result.fallback_reason == "Google Places indisponível"
    # Sem OSRM, distância em linha reta e tempo desconhecido — mas a lista sai.
    assert all(not p.by_road and p.duration_seconds is None for p in result.places)


@respx.mock
async def test_limite_diario_protege_a_cota(client):
    google = respx.post(GOOGLE_URL).mock(return_value=httpx.Response(200, json=GOOGLE_OK))
    respx.post(OVERPASS).mock(return_value=httpx.Response(200, json=OVERPASS_OK))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(200, json=TABLE_OK))
    service = build(client, limit=1)

    await service.search(NearbyCategory.POSTO, ORIGIN)
    second = await service.search(NearbyCategory.POSTO, ORIGIN)

    assert google.call_count == 1
    assert second.source == "openstreetmap"
    assert second.fallback_reason == "limite diário do Google Places atingido"


@respx.mock
async def test_as_duas_fontes_fora_responde_erro_de_dominio(client):
    respx.post(GOOGLE_URL).mock(side_effect=httpx.ConnectError("sem rede"))
    respx.post(OVERPASS).mock(side_effect=httpx.ConnectError("sem rede"))

    with pytest.raises(NearbyUnavailableError):
        await build(client).search(NearbyCategory.POSTO, ORIGIN)


@respx.mock
async def test_overpass_sobrecarregado_nao_vira_lista_vazia(client):
    """O Overpass esconde o erro num 200 com `remark` — tem que contar como falha."""
    respx.post(OVERPASS).mock(
        return_value=httpx.Response(
            200, json={"elements": [], "remark": "runtime error: Query timed out"}
        )
    )

    with pytest.raises(NearbyUnavailableError):
        await build(client, google=False).search(NearbyCategory.POSTO, ORIGIN)


def test_limite_diario_zera_no_dia_seguinte():
    today = {"value": date(2026, 9, 18)}
    budget = DailyBudget(1, today=lambda: today["value"])

    assert budget.try_spend() is True
    assert budget.try_spend() is False

    today["value"] = date(2026, 9, 19)
    assert budget.try_spend() is True


def test_endpoint_valida_categoria():
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as api:
        response = api.get(
            "/v1/nearby", params={"category": "cinema", "latitude": -22.8, "longitude": -47.0}
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


TOMTOM_NEARBY = {"url__startswith": "https://api.tomtom.com/search/2/nearbySearch/"}

TOMTOM_OK = {
    "results": [
        {
            "type": "POI",
            "id": "wQ4c",
            "poi": {"name": "OVG Combustíveis", "categorySet": [{"id": 7311}]},
            "address": {"streetName": "Rua Taquaral", "streetNumber": "235"},
            "position": {"lat": -22.8734, "lon": -47.0541},
            # A entrada é onde o carro chega — e é o ponto que vale.
            "entryPoints": [{"type": "main", "position": {"lat": -22.8735, "lon": -47.0540}}],
        },
        {"type": "POI", "id": "sem-nome", "poi": {}, "position": {"lat": -22.87, "lon": -47.05}},
    ]
}


@respx.mock
async def test_sem_google_a_tomtom_responde_sem_nota(client):
    tomtom = respx.get(**TOMTOM_NEARBY).mock(return_value=httpx.Response(200, json=TOMTOM_OK))
    overpass = respx.post(OVERPASS)
    respx.get(**OSRM_TABLE).mock(
        return_value=httpx.Response(
            200, json={"code": "Ok", "durations": [[0, 120]], "distances": [[0, 900]]}
        )
    )

    result = await build(client, google=False, tomtom=True).search(NearbyCategory.POSTO, ORIGIN)

    assert result.source == "tomtom"
    assert result.fallback_reason is None
    assert overpass.call_count == 0
    [place] = result.places
    assert place.name == "OVG Combustíveis"
    assert place.address == "Rua Taquaral, 235"
    assert (place.latitude, place.longitude) == (-22.8735, -47.0540)
    assert place.rating is None

    sent = tomtom.calls.last.request.url.params
    assert sent["categorySet"] == "7311"
    assert sent["key"] == "chave-tomtom"


@respx.mock
async def test_tomtom_emergencia_descarta_servico_de_saude_que_nao_e_hospital(client):
    payload = {
        "results": [
            {
                "type": "POI",
                "id": "vigilancia",
                "poi": {"name": "Vigilância Alimentar", "categorySet": [{"id": 9663}]},
                "position": {"lat": -22.87, "lon": -47.05},
            },
            {
                "type": "POI",
                "id": "hospital",
                "poi": {"name": "Hospital Municipal", "categorySet": [{"id": 7321001}]},
                "position": {"lat": -22.88, "lon": -47.06},
            },
            {
                "type": "POI",
                "id": "pronto-socorro",
                "poi": {"name": "Pronto-Socorro Central", "categorySet": [{"id": 9956}]},
                "position": {"lat": -22.89, "lon": -47.07},
            },
        ]
    }
    tomtom = respx.get(**TOMTOM_NEARBY).mock(return_value=httpx.Response(200, json=payload))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(500))

    result = await build(client, google=False, tomtom=True).search(NearbyCategory.HOSPITAL, ORIGIN)

    assert [place.name for place in result.places] == ["Hospital Municipal", "Pronto-Socorro Central"]
    assert tomtom.calls.last.request.url.params["categorySet"] == "7321,9956"


@respx.mock
async def test_emergencia_descarta_nome_inadequado_e_tenta_a_reserva(client):
    invalid_google = {
        "places": [
            {
                "id": "vigilancia",
                "displayName": {"text": "Vigilância Sanitária"},
                "location": {"latitude": -22.8620, "longitude": -47.0455},
                "businessStatus": "OPERATIONAL",
            }
        ]
    }
    respx.post(GOOGLE_URL).mock(return_value=httpx.Response(200, json=invalid_google))
    respx.post(OVERPASS).mock(return_value=httpx.Response(200, json=OVERPASS_OK))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(500))

    result = await build(client).search(NearbyCategory.HOSPITAL, ORIGIN)

    assert result.source == "openstreetmap"
    assert [place.name for place in result.places] == ["Hospital Municipal", "Hospital Regional"]


@respx.mock
async def test_google_fora_cai_na_tomtom_e_diz_por_que(client):
    respx.post(GOOGLE_URL).mock(return_value=httpx.Response(403, text="billing"))
    respx.get(**TOMTOM_NEARBY).mock(return_value=httpx.Response(200, json=TOMTOM_OK))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(500))

    result = await build(client, tomtom=True).search(NearbyCategory.POSTO, ORIGIN)

    assert result.source == "tomtom"
    assert result.fallback_reason == "Google Places indisponível"


@respx.mock
async def test_tomtom_fora_cai_no_openstreetmap(client):
    respx.get(**TOMTOM_NEARBY).mock(return_value=httpx.Response(403))
    respx.post(OVERPASS).mock(return_value=httpx.Response(200, json=OVERPASS_OK))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(500))

    result = await build(client, google=False, tomtom=True).search(NearbyCategory.HOSPITAL, ORIGIN)

    assert result.source == "openstreetmap"
    assert result.fallback_reason == "TomTom indisponível"


@respx.mock
async def test_erro_da_tomtom_nao_vaza_a_chave(client, caplog):
    respx.get(**TOMTOM_NEARBY).mock(side_effect=httpx.ConnectError("falhou em ?key=chave-tomtom"))
    respx.post(OVERPASS).mock(return_value=httpx.Response(200, json=OVERPASS_OK))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(500))

    await build(client, google=False, tomtom=True).search(NearbyCategory.HOSPITAL, ORIGIN)

    assert "chave-tomtom" not in caplog.text


@respx.mock
async def test_lista_da_tela_pede_mais_candidatos_e_devolve_ate_o_limite(client):
    many = {
        "results": [
            {
                "type": "POI",
                "id": f"p{i}",
                "poi": {"name": f"Posto {i}"},
                "position": {"lat": -22.86 - i / 1000, "lon": -47.04},
            }
            for i in range(20)
        ]
    }
    tomtom = respx.get(**TOMTOM_NEARBY).mock(return_value=httpx.Response(200, json=many))
    respx.get(**OSRM_TABLE).mock(return_value=httpx.Response(500))

    service = build(client, google=False, tomtom=True)
    ten = await service.search(NearbyCategory.POSTO, ORIGIN, limit=10)
    assert tomtom.calls.last.request.url.params["limit"] == "20"
    assert len(ten.places) == 10

    three = await service.search(NearbyCategory.POSTO, ORIGIN)
    assert tomtom.calls.last.request.url.params["limit"] == "6"
    assert len(three.places) == 3


def test_endpoint_nao_passa_de_10():
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app()) as api:
        response = api.get(
            "/v1/nearby",
            params={"category": "posto", "latitude": -22.8, "longitude": -47.0, "limit": 11},
        )

    assert response.status_code == 422
