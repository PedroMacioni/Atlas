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
