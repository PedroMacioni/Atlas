"""
Chave e ciclo do cache de rotas.

O que importa provar: pedidos praticamente iguais compartilham a linha
(senão o cache nunca acerta), pedidos diferentes não (senão devolve a rota
errada), e a direção conta — ida e volta não são o mesmo trajeto.
"""

from app.providers.base import ProviderRoute
from app.repositories.route_cache_repository import RouteCacheRepository, build_cache_key
from app.schemas.coordinate import Coordinate

CAMPINAS = Coordinate(latitude=-22.9099, longitude=-47.0626)
VIRACOPOS = Coordinate(latitude=-23.0074, longitude=-47.1345)


def test_mesmo_par_gera_a_mesma_chave():
    assert build_cache_key("osrm", CAMPINAS, VIRACOPOS) == build_cache_key(
        "osrm", CAMPINAS, VIRACOPOS
    )


def test_diferenca_de_metros_compartilha_a_chave():
    # 5ª casa decimal ≈ 1 m: o trajeto calculado seria idêntico.
    quase_igual = Coordinate(latitude=-22.909903, longitude=-47.062604)

    assert build_cache_key("osrm", quase_igual, VIRACOPOS) == build_cache_key(
        "osrm", CAMPINAS, VIRACOPOS
    )


def test_diferenca_de_quilometros_nao_compartilha_a_chave():
    outro_bairro = Coordinate(latitude=-22.95, longitude=-47.10)

    assert build_cache_key("osrm", outro_bairro, VIRACOPOS) != build_cache_key(
        "osrm", CAMPINAS, VIRACOPOS
    )


def test_a_direcao_importa():
    ida = build_cache_key("osrm", CAMPINAS, VIRACOPOS)
    volta = build_cache_key("osrm", VIRACOPOS, CAMPINAS)

    assert ida != volta


def test_provider_diferente_nao_reaproveita_rota():
    # Uma rota da Google não deve ser servida como se fosse do OSRM.
    assert build_cache_key("google", CAMPINAS, VIRACOPOS) != build_cache_key(
        "osrm", CAMPINAS, VIRACOPOS
    )


async def test_ttl_zero_desliga_leitura_e_escrita(database):
    cache = RouteCacheRepository(database, ttl_seconds=0)
    route = ProviderRoute([CAMPINAS, VIRACOPOS], 1000.0, 600.0)

    assert await cache.get("qualquer") is None
    await cache.put(
        "qualquer", provider_id="osrm", origin=CAMPINAS, destination=VIRACOPOS, route=route
    )

    # Nem consultou, nem gravou.
    assert database.selects == []
    assert database.upserts == []


async def test_grava_geometria_em_longitude_latitude(database):
    cache = RouteCacheRepository(database, ttl_seconds=60)
    route = ProviderRoute([CAMPINAS, VIRACOPOS], 1000.0, 600.0)

    await cache.put(
        "chave", provider_id="osrm", origin=CAMPINAS, destination=VIRACOPOS, route=route
    )

    _, row = database.upserts[0]

    # Volta para GeoJSON na escrita, para sair igual a como entrou do provider.
    assert row["geometry"][0] == [CAMPINAS.longitude, CAMPINAS.latitude]
    assert row["cache_key"] == "chave"


async def test_geometria_corrompida_no_banco_e_tratada_como_ausencia(database):
    cache = RouteCacheRepository(database, ttl_seconds=60)
    database.rows["route_cache"] = [
        {"distance_meters": 1.0, "duration_seconds": 1.0, "geometry": [[1.0, 2.0]]}
    ]

    # Uma linha estragada não pode virar uma rota de um ponto só.
    assert await cache.get("chave") is None
