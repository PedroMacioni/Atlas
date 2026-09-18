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


# --- manobras no contrato ---------------------------------------------------

OSRM_COM_STEPS = {
    "code": "Ok",
    "routes": [
        {
            "distance": 1000.0,
            "duration": 600.0,
            "geometry": {
                "type": "LineString",
                "coordinates": [[-47.0626, -22.9099], [-47.1345, -23.0074]],
            },
            "legs": [
                {
                    "steps": [
                        {
                            "name": "Rua José Paulino",
                            "distance": 400.0,
                            "maneuver": {
                                "type": "depart",
                                "modifier": "right",
                                "location": [-47.0626, -22.9099],
                            },
                        },
                        {
                            "name": "Rua Luiz Otávio",
                            "distance": 600.0,
                            "maneuver": {
                                "type": "turn",
                                "modifier": "left",
                                "location": [-47.10, -22.95],
                            },
                        },
                    ]
                }
            ],
        }
    ],
}


@respx.mock
def test_manobras_saem_em_camel_case_como_o_app_espera(client):
    respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(200, json=OSRM_COM_STEPS))

    body = client.post("/v1/routes", json=PEDIDO).json()

    assert len(body["steps"]) == 2
    primeira = body["steps"][0]
    # Os nomes são os do tipo `RouteStep` do aplicativo — sem tradução no meio.
    assert set(primeira) == {
        "type",
        "modifier",
        "roadName",
        "distanceAlongRouteMeters",
        "location",
    }
    assert body["steps"][1]["roadName"] == "Rua Luiz Otávio"
    assert body["steps"][1]["distanceAlongRouteMeters"] == 400.0


@respx.mock
def test_manobras_sobrevivem_ao_cache(client, database):
    # Uma rota servida do cache sem manobras faria a faixa de instrução
    # desaparecer da tela sem motivo visível.
    database.rows["route_cache"] = [
        {
            "distance_meters": 1000.0,
            "duration_seconds": 600.0,
            "geometry": [[-47.0626, -22.9099], [-47.1345, -23.0074]],
            "steps": [
                {
                    "type": "turn",
                    "modifier": "left",
                    "roadName": "Rua Luiz Otávio",
                    "distanceAlongRouteMeters": 400.0,
                    "location": {"latitude": -22.95, "longitude": -47.10},
                }
            ],
        }
    ]

    body = client.post("/v1/routes", json=PEDIDO).json()

    assert body["cached"] is True
    assert body["steps"][0]["roadName"] == "Rua Luiz Otávio"


@respx.mock
def test_manobras_gravadas_no_cache_em_camel_case(client, database):
    respx.get(**OSRM_ROUTE).mock(return_value=httpx.Response(200, json=OSRM_COM_STEPS))

    client.post("/v1/routes", json=PEDIDO)

    _, row = database.upserts[0]

    # Grava no formato em que será lido, para que a leitura seja direta.
    assert row["steps"][1]["roadName"] == "Rua Luiz Otávio"
    assert row["steps"][1]["distanceAlongRouteMeters"] == 400.0


@respx.mock
def test_cache_com_manobras_corrompidas_devolve_rota_sem_instrucoes(client, database):
    database.rows["route_cache"] = [
        {
            "distance_meters": 1000.0,
            "duration_seconds": 600.0,
            "geometry": [[-47.0626, -22.9099], [-47.1345, -23.0074]],
            "steps": [{"type": "isso nao e um tipo valido"}],
        }
    ]

    response = client.post("/v1/routes", json=PEDIDO)

    # Degradação aceitável: o trajeto continua desenhado, sem a faixa.
    assert response.status_code == 200
    assert response.json()["steps"] == []
