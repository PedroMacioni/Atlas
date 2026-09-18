"""
Parsing do provider OSRM.

É o ponto de contato com um formato de terceiro, e por isso o mais frágil do
backend: a inversão de eixos do GeoJSON, um `code` diferente de `Ok`, uma
geometria curta. Tudo aqui é função pura sobre um dicionário — nenhuma rede.
"""

import pytest

from app.core.errors import RouteNotFound, RouteProviderUnavailable
from app.providers.osrm import OsrmRouteProvider


def payload(coordinates, *, code="Ok", distance=1000.0, duration=600.0):
    return {
        "code": code,
        "routes": [
            {
                "distance": distance,
                "duration": duration,
                "geometry": {"type": "LineString", "coordinates": coordinates},
            }
        ],
    }


def test_inverte_os_eixos_do_geojson():
    # GeoJSON vem em [longitude, latitude]; a Polyline precisa do contrário.
    route = OsrmRouteProvider._parse(payload([[-47.1345, -23.0074], [-46.6576, -23.5874]]))

    assert route.coordinates[0].latitude == pytest.approx(-23.0074)
    assert route.coordinates[0].longitude == pytest.approx(-47.1345)
    assert route.distance_meters == 1000.0
    assert route.duration_seconds == 600.0


def test_descarta_pares_invalidos_mantendo_os_validos():
    route = OsrmRouteProvider._parse(
        payload(
            [
                [-47.1345, -23.0074],
                [None, -23.5],  # nulo
                ["-46.6", "-23.5"],  # string
                [-46.6576, -23.5874],
                [999.0, -23.5],  # fora de faixa
            ]
        )
    )

    assert len(route.coordinates) == 2


def test_no_route_e_resposta_legitima_nao_falha_de_provider():
    # O serviço respondeu certo: simplesmente não existe trajeto.
    with pytest.raises(RouteNotFound):
        OsrmRouteProvider._parse({"code": "NoRoute"})


def test_code_desconhecido_e_falha_do_provider():
    with pytest.raises(RouteProviderUnavailable):
        OsrmRouteProvider._parse({"code": "InvalidUrl", "message": "url ruim"})


def test_geometria_com_um_ponto_nao_desenha_rota():
    with pytest.raises(RouteProviderUnavailable):
        OsrmRouteProvider._parse(payload([[-47.1345, -23.0074]]))


def test_rota_sem_distancia_e_recusada():
    broken = payload([[-47.1, -23.0], [-46.6, -23.5]])
    del broken["routes"][0]["distance"]

    with pytest.raises(RouteProviderUnavailable):
        OsrmRouteProvider._parse(broken)


def test_no_segment_vira_ausencia_de_rota():
    # É a resposta do OSRM quando nenhum ponto tem via dentro do raio de
    # encaixe — sem o raio, ele devolveria `Ok` com uma rota a 1.400 km.
    with pytest.raises(RouteNotFound):
        OsrmRouteProvider._parse({"code": "NoSegment"})


# --- manobras ---------------------------------------------------------------


def payload_com_steps():
    """Resposta com dois passos, no formato que o OSRM devolve."""
    return {
        "code": "Ok",
        "routes": [
            {
                "distance": 1000.0,
                "duration": 600.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-47.06, -22.90], [-47.05, -22.88]],
                },
                "legs": [
                    {
                        "steps": [
                            {
                                "name": "Rua José Paulino",
                                "distance": 408.0,
                                "maneuver": {
                                    "type": "depart",
                                    "modifier": "right",
                                    "location": [-47.061022, -22.905682],
                                },
                            },
                            {
                                "name": "Rua Barreto Leme",
                                "distance": 592.0,
                                "maneuver": {
                                    "type": "end of road",
                                    "modifier": "sharp left",
                                    "location": [-47.062644, -22.902322],
                                },
                            },
                        ]
                    }
                ],
            }
        ],
    }


def test_manobras_viram_distancia_acumulada():
    route = OsrmRouteProvider._parse(payload_com_steps())

    # O OSRM dá a distância *do* passo; a API expõe a distância acumulada até
    # a manobra, que é o que permite saber o que falta por subtração.
    assert [step.distance_along_route_meters for step in route.steps] == [0.0, 408.0]
    assert route.steps[1].road_name == "Rua Barreto Leme"


def test_vocabulario_do_osrm_e_normalizado():
    route = OsrmRouteProvider._parse(payload_com_steps())

    # "end of road" com espaços vira "end-of-road"; "sharp left", "sharp-left".
    assert route.steps[1].type == "end-of-road"
    assert route.steps[1].modifier == "sharp-left"


def test_tipo_desconhecido_vira_continue():
    payload = payload_com_steps()
    payload["routes"][0]["legs"][0]["steps"][1]["maneuver"]["type"] = "algo que o osrm inventou"

    route = OsrmRouteProvider._parse(payload)

    # Seguir em frente é a única instrução que nunca manda para o lugar errado.
    assert route.steps[1].type == "continue"


def test_manobra_sem_localizacao_e_descartada_sem_derrubar_a_rota():
    payload = payload_com_steps()
    del payload["routes"][0]["legs"][0]["steps"][0]["maneuver"]["location"]

    route = OsrmRouteProvider._parse(payload)

    assert len(route.steps) == 1
    assert route.steps[0].road_name == "Rua Barreto Leme"


def test_rota_sem_legs_nao_tem_manobras_mas_continua_valida():
    payload = payload_com_steps()
    del payload["routes"][0]["legs"]

    route = OsrmRouteProvider._parse(payload)

    # Instruções são um extra sobre um trajeto que já é útil sem elas.
    assert route.steps == []
    assert route.distance_meters == 1000.0
