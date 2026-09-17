"""
Os endpoints, de ponta a ponta — com o OSRM interceptado e o banco dublado.

O foco é o contrato: os nomes dos campos que o aplicativo consome, os códigos
de erro que ele usa para escolher a mensagem de tela, e a promessa de que uma
falha de cache não derruba uma rota.
"""

import httpx
import respx

from app.core.errors import DatabaseUnavailable

# O padrão casa qualquer par de coordenadas no path.
OSRM_ROUTE = {"url__startswith": "https://osrm.test/route/v1/driving/"}

OSRM_OK = {
    "code": "Ok",
    "routes": [
        {
            "distance": 28_431.2,
            "duration": 1_784.6,
            "geometry": {
                "type": "LineString",
                "coordinates": [[-47.0626, -22.9099], [-47.10, -22.95], [-47.1345, -23.0074]],
            },
        }
    ],
}

PEDIDO = {
    "origin": {"latitude": -22.9099, "longitude": -47.0626},
    "destination": {"latitude": -23.0074, "longitude": -47.1345},
}


# --- /health ---------------------------------------------------------------


def test_health_diz_ok_quando_o_banco_responde(client):
    body = client.get("/health").json()

    assert body["status"] == "ok"
    assert body["database"] is True
    assert body["routeProvider"] == "osrm-public-demo"


def test_health_diz_degraded_sem_derrubar_a_api(client, database):
    database.ping_fails = True

    response = client.get("/health")

    # 200 de propósito: sem banco a API ainda calcula rotas.
    assert response.status_code == 200
    assert response.json()["status"] == "degraded"
    assert response.json()["database"] is False


# --- /v1/routes ------------------------------------------------------------


@respx.mock
def test_rota_nova_chama_o_provider_e_devolve_o_contrato_do_app(client, database):
    respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(200, json=OSRM_OK))

    body = client.post("/v1/routes", json=PEDIDO).json()

    # Os três campos que a Polyline e o TripSummaryCard já consomem hoje.
    assert body["distanceMeters"] == 28_431.2
    assert body["durationSeconds"] == 1_784.6
    assert body["coordinates"][0] == {"latitude": -22.9099, "longitude": -47.0626}
    assert body["cached"] is False
    assert body["provider"] == "osrm-public-demo"

    # E a rota foi guardada para a próxima vez.
    assert database.upserts[0][0] == "route_cache"


@respx.mock
def test_rota_em_cache_nao_toca_o_provider(client, database):
    provider_call = respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(200, json=OSRM_OK))
    database.rows["route_cache"] = [
        {
            "distance_meters": 28_431.2,
            "duration_seconds": 1_784.6,
            "geometry": [[-47.0626, -22.9099], [-47.1345, -23.0074]],
        }
    ]

    body = client.post("/v1/routes", json=PEDIDO).json()

    assert body["cached"] is True
    assert not provider_call.called
    # Nada de regravar o que já estava lá.
    assert database.upserts == []


@respx.mock
def test_banco_fora_nao_impede_a_rota(client, database):
    respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(200, json=OSRM_OK))
    database.raises = DatabaseUnavailable("banco fora, no teste")

    response = client.post("/v1/routes", json=PEDIDO)

    # O cache é conveniência; o provider é a fonte da verdade.
    assert response.status_code == 200
    assert response.json()["cached"] is False


@respx.mock
def test_timeout_do_provider_vira_504_com_codigo_proprio(client):
    respx.get(**OSRM_ROUTE).mock(side_effect=httpx.ConnectTimeout("estourou"))

    response = client.post("/v1/routes", json=PEDIDO)

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "route_provider_timeout"


@respx.mock
def test_provider_fora_do_ar_vira_502(client):
    respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(503))

    response = client.post("/v1/routes", json=PEDIDO)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "route_provider_unavailable"


@respx.mock
def test_limita_o_raio_de_encaixe_do_provider(client):
    chamada = respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(200, json=OSRM_OK))

    client.post("/v1/routes", json=PEDIDO)

    # Sem o raio, um ponto sem estrada por perto receberia uma rota que começa
    # em outro estado, e com `code: Ok`.
    assert chamada.calls.last.request.url.params["radiuses"] == "10000;10000"


@respx.mock
def test_ausencia_de_trajeto_vira_404(client):
    respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(200, json={"code": "NoRoute"}))

    response = client.post("/v1/routes", json=PEDIDO)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "route_not_found"


def test_coordenada_fora_da_faixa_e_recusada_antes_de_qualquer_chamada(client):
    response = client.post(
        "/v1/routes",
        json={
            "origin": {"latitude": -200, "longitude": -47.0},
            "destination": {"latitude": -23.0, "longitude": -47.1},
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


# --- /v1/places ------------------------------------------------------------


def test_lista_de_lugares_usa_os_nomes_do_tipo_place_do_app(client, database):
    database.rpc_rows = [
        {
            "id": "viracopos",
            "name": "Aeroporto de Viracopos",
            "address": "Campinas, SP",
            "category": "saved",
            "saved": True,
            "latitude": -23.0074,
            "longitude": -47.1345,
        }
    ]

    body = client.get("/v1/places", params={"query": "sao paulo"}).json()

    assert body["count"] == 1
    assert body["places"][0]["id"] == "viracopos"
    assert body["places"][0]["category"] == "saved"


def test_categoria_invalida_e_recusada(client):
    response = client.get("/v1/places", params={"category": "aeroporto"})

    assert response.status_code == 422


def test_lugar_inexistente_vira_404_com_codigo_proprio(client, database):
    database.rows["places"] = []

    response = client.get("/v1/places/nao-existe")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "place_not_found"


@respx.mock
def test_recusa_de_dominio_com_status_400_vira_404(client):
    # O OSRM responde 400 + `NoSegment` quando o ponto não tem via dentro do
    # raio de encaixe. O código do corpo manda, não o status.
    respx.get(**OSRM_ROUTE).mock(
        return_value=httpx.Response(400, json={"code": "NoSegment", "message": "sem via"})
    )

    response = client.post("/v1/routes", json=PEDIDO)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "route_not_found"


@respx.mock
def test_erro_sem_corpo_utilizavel_cai_no_status(client):
    respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(500, text="<html>erro</html>"))

    response = client.post("/v1/routes", json=PEDIDO)

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "route_provider_unavailable"
