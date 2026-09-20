"""
Busca de destino: o catálogo primeiro, a TomTom depois. Nenhuma rede — a
TomTom é interceptada por `respx` e o banco é o dublê do `conftest`.
"""

import httpx
import pytest
import respx

from app.providers.tomtom import TomTomPlaceSearch
from app.repositories.place_repository import PlaceRepository
from app.schemas.coordinate import Coordinate
from app.schemas.place import PlaceCategory
from app.services.daily_budget import DailyBudget
from app.services.place_service import PlaceService

TOMTOM_SEARCH = {"url__startswith": "https://api.tomtom.com/search/2/search/"}
CAMPINAS = Coordinate(latitude=-22.87, longitude=-47.05)

SAVED = {
    "id": "anhanguera-taquaral",
    "name": "Faculdade Anhanguera Taquaral",
    "address": "Rua Luiz Otávio, 1313",
    "category": "saved",
    "saved": True,
    "latitude": -22.8700,
    "longitude": -47.0500,
}

TOMTOM_OK = {
    "results": [
        {
            # O mesmo lugar do catálogo, 30 m ao lado: não pode aparecer duas vezes.
            "type": "POI",
            "id": "repetido",
            "poi": {"name": "Faculdade Anhanguera-Taquaral", "categorySet": [{"id": 7377}]},
            "address": {"municipality": "Campinas"},
            "position": {"lat": -22.8702, "lon": -47.0502},
        },
        {
            "type": "POI",
            "id": "shell",
            "poi": {"name": "Posto Shell", "categorySet": [{"id": 7311}]},
            "address": {
                "streetName": "Avenida José Bonifácio",
                "streetNumber": "1237",
                "municipality": "Campinas",
            },
            "position": {"lat": -22.88, "lon": -47.06},
        },
        {
            "type": "Point Address",
            "id": "rondon",
            "address": {
                "streetName": "Avenida Marechal Rondon",
                "streetNumber": "700",
                "municipalitySubdivision": "Jardim Chapadão",
                "municipality": "Campinas",
                "countrySubdivisionCode": "SP",
            },
            "position": {"lat": -22.89, "lon": -47.07},
        },
        {
            "type": "POI",
            "id": "restaurante",
            "poi": {"name": "Cantina", "categorySet": [{"id": 7315081}]},
            "address": {"freeformAddress": "Campinas"},
            "position": {"lat": -22.9, "lon": -47.08},
        },
    ]
}


@pytest.fixture
async def http():
    async with httpx.AsyncClient() as client:
        yield client


def build(database, http, *, limit=100):
    return PlaceService(
        PlaceRepository(database),
        external=TomTomPlaceSearch(http, "chave-tomtom"),
        budget=DailyBudget(limit),
    )


@respx.mock
async def test_salvos_primeiro_e_a_tomtom_completa_sem_repetir(database, http):
    database.rpc_rows = [SAVED]
    tomtom = respx.get(**TOMTOM_SEARCH).mock(return_value=httpx.Response(200, json=TOMTOM_OK))

    result = await build(database, http).search(
        query="anhanguera", category=None, limit=20, near=CAMPINAS
    )

    assert [p.id for p in result.places] == [
        "anhanguera-taquaral",
        "tomtom:shell",
        "tomtom:rondon",
        "tomtom:restaurante",
    ]
    shell, rondon, cantina = result.places[1:]
    assert (shell.category, shell.address) == (
        PlaceCategory.FUEL,
        "Avenida José Bonifácio, 1237, Campinas",
    )
    # Um endereço é o próprio nome; o bairro e a cidade vão embaixo.
    assert (rondon.name, rondon.address) == (
        "Avenida Marechal Rondon, 700",
        "Jardim Chapadão, Campinas, SP",
    )
    assert rondon.category == PlaceCategory.OTHER
    # Subcategoria de 7 dígitos ainda é restaurante.
    assert cantina.category == PlaceCategory.FOOD

    sent = tomtom.calls.last.request.url
    assert sent.path.endswith("/search/anhanguera.json")
    assert sent.params["typeahead"] == "true"
    assert sent.params["countrySet"] == "BR"
    assert (sent.params["lat"], sent.params["lon"]) == ("-22.87", "-47.05")


@respx.mock
async def test_texto_com_barra_nao_quebra_a_url(database, http):
    tomtom = respx.get(**TOMTOM_SEARCH).mock(return_value=httpx.Response(200, json={}))

    await build(database, http).search(query="rua 7/8", category=None, limit=20)

    assert "/search/rua%207%2F8.json" in str(tomtom.calls.last.request.url)
    assert "lat" not in tomtom.calls.last.request.url.params


@respx.mock
@pytest.mark.parametrize(
    ("query", "category"),
    [(None, None), ("po", None), ("posto", PlaceCategory.SAVED)],
)
async def test_sem_texto_suficiente_ou_com_filtro_so_o_catalogo(database, http, query, category):
    tomtom = respx.get(**TOMTOM_SEARCH)

    await build(database, http).search(query=query, category=category, limit=20)

    assert tomtom.call_count == 0


@respx.mock
async def test_tomtom_fora_devolve_so_o_catalogo(database, http):
    database.rpc_rows = [SAVED]
    respx.get(**TOMTOM_SEARCH).mock(return_value=httpx.Response(403))

    result = await build(database, http).search(query="anhanguera", category=None, limit=20)

    assert [p.id for p in result.places] == ["anhanguera-taquaral"]


@respx.mock
async def test_limite_diario_desliga_a_busca_externa(database, http):
    tomtom = respx.get(**TOMTOM_SEARCH).mock(return_value=httpx.Response(200, json=TOMTOM_OK))
    service = build(database, http, limit=1)

    await service.search(query="posto", category=None, limit=20)
    second = await service.search(query="posto", category=None, limit=20)

    assert tomtom.call_count == 1
    assert second.count == 0


@respx.mock
async def test_limite_da_tela_vale_para_a_soma(database, http):
    database.rpc_rows = [SAVED]
    respx.get(**TOMTOM_SEARCH).mock(return_value=httpx.Response(200, json=TOMTOM_OK))

    result = await build(database, http).search(query="anhanguera", category=None, limit=2)

    assert [p.id for p in result.places] == ["anhanguera-taquaral", "tomtom:shell"]


def test_endpoint_aceita_a_localizacao_de_quem_busca(client, database):
    database.rpc_rows = [SAVED]

    response = client.get(
        "/v1/places", params={"query": "anhanguera", "latitude": -22.87, "longitude": -47.05}
    )

    assert response.status_code == 200
    assert response.json()["places"][0]["id"] == "anhanguera-taquaral"


def test_endpoint_recusa_latitude_fora_da_faixa(client):
    response = client.get("/v1/places", params={"latitude": 91, "longitude": -47.05})

    assert response.status_code == 422
