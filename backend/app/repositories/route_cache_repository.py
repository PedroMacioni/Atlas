"""
Cache de rotas em Postgres.

O ganho não é velocidade — é **não depender** do provider externo a cada toque
na tela. O OSRM público aplica limites não documentados; o Google Routes cobra
por chamada. Um par origem-destino repetido é a regra, não a exceção: o mesmo
trajeto de casa para o trabalho, todo dia.

A chave é determinística e arredondada, para que dois pedidos praticamente
iguais compartilhem a mesma linha.
"""

import hashlib
from datetime import UTC, datetime, timedelta

from app.core.database import SupabaseRest
from app.providers.base import ProviderRoute
from app.schemas.coordinate import Coordinate
from app.schemas.route import RouteStep

TABLE = "route_cache"

# 4 casas decimais ≈ 11 m. Abaixo disso o trajeto calculado é o mesmo, e cada
# casa a mais só fragmenta o cache sem melhorar a resposta.
_COORDINATE_PRECISION = 4


def build_cache_key(provider_id: str, origin: Coordinate, destination: Coordinate) -> str:
    """Identidade estável de um pedido de rota, independente do provider."""
    raw = "|".join(
        (
            provider_id,
            _quantize(origin.latitude),
            _quantize(origin.longitude),
            _quantize(destination.latitude),
            _quantize(destination.longitude),
        )
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _quantize(value: float) -> str:
    return f"{round(value, _COORDINATE_PRECISION):.{_COORDINATE_PRECISION}f}"


class RouteCacheRepository:
    def __init__(self, database: SupabaseRest, ttl_seconds: int) -> None:
        self._database = database
        self._ttl = timedelta(seconds=ttl_seconds)

    async def get(self, cache_key: str) -> ProviderRoute | None:
        """Devolve a rota guardada, ou `None` se não existe ou já venceu."""
        if self._ttl.total_seconds() <= 0:
            return None

        now = datetime.now(UTC).isoformat()

        rows = await self._database.select(
            TABLE,
            params={
                "select": "distance_meters,duration_seconds,geometry,steps",
                "cache_key": f"eq.{cache_key}",
                # A validade é filtrada no banco: uma linha vencida nunca chega.
                "expires_at": f"gt.{now}",
                "limit": 1,
            },
        )

        if not rows:
            return None

        return _row_to_route(rows[0])

    async def put(
        self,
        cache_key: str,
        *,
        provider_id: str,
        origin: Coordinate,
        destination: Coordinate,
        route: ProviderRoute,
    ) -> None:
        """Guarda a rota. A geometria vai como GeoJSON, em [longitude, latitude]."""
        if self._ttl.total_seconds() <= 0:
            return

        await self._database.upsert(
            TABLE,
            {
                "cache_key": cache_key,
                "provider": provider_id,
                "origin_latitude": origin.latitude,
                "origin_longitude": origin.longitude,
                "dest_latitude": destination.latitude,
                "dest_longitude": destination.longitude,
                "distance_meters": route.distance_meters,
                "duration_seconds": route.duration_seconds,
                "geometry": [[c.longitude, c.latitude] for c in route.coordinates],
                # As manobras vão como a API as expõe (camelCase), para que a
                # leitura seja uma desserialização direta, sem tradução.
                "steps": [step.model_dump(by_alias=True) for step in route.steps],
                "expires_at": (datetime.now(UTC) + self._ttl).isoformat(),
            },
            on_conflict="cache_key",
        )


def _row_to_route(row: dict) -> ProviderRoute | None:
    """Reconstrói a rota a partir da linha, ou desiste se o corpo não confere."""
    geometry = row.get("geometry")

    if not isinstance(geometry, list) or len(geometry) < 2:
        return None

    coordinates: list[Coordinate] = []

    for pair in geometry:
        if not isinstance(pair, list | tuple) or len(pair) < 2:
            return None
        coordinates.append(Coordinate(latitude=pair[1], longitude=pair[0]))

    return ProviderRoute(
        coordinates=coordinates,
        distance_meters=float(row["distance_meters"]),
        duration_seconds=float(row["duration_seconds"]),
        steps=_parse_steps(row.get("steps")),
    )


def _parse_steps(raw: object) -> list[RouteStep]:
    """
    Reconstrói as manobras guardadas.

    Uma linha gravada antes de as manobras existirem não tem nada aqui, e uma
    linha corrompida não deve derrubar a rota — nos dois casos a resposta sai
    sem instruções, que é degradação aceitável: o trajeto continua desenhado.
    """
    if not isinstance(raw, list):
        return []

    try:
        return [RouteStep.model_validate(step) for step in raw]
    except ValueError:
        return []
