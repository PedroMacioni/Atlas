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
from app.schemas.coordinate import Coordinate
from app.schemas.nearby import NearbyCategory
from app.services.nearby_service import DailyBudget, NearbyService

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


def build(client, *, google=True, limit=30):
    return NearbyService(
        google=GooglePlacesProvider(client, "chave-de-teste") if google else None,
        fallback=OverpassProvider(client, OVERPASS),
        router=OsrmRouteProvider(client, "https://osrm.test"),
        budget=DailyBudget(limit),
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
    assert result.fallback_reason == "Google Places não configurado"
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
