"""
Serviço de rotas: sempre na mesma ordem.

    1. procura a rota no cache;
    2. se não achar, pede ao serviço de rotas (OSRM);
    3. guarda o resultado no cache;
    4. devolve, dizendo se veio do cache ou não.

Se o cache falhar (na leitura ou na escrita), a rota é entregue mesmo assim.
O cache só serve para economizar chamadas.
"""

import logging

from app.core.errors import DatabaseUnavailable
from app.providers.base import RouteProvider
from app.repositories.route_cache_repository import RouteCacheRepository, build_cache_key
from app.schemas.coordinate import Coordinate
from app.schemas.route import RouteResponse

logger = logging.getLogger("atlas.api")


class RouteService:
    def __init__(self, provider: RouteProvider, cache: RouteCacheRepository) -> None:
        self._provider = provider
        self._cache = cache

    @property
    def provider_id(self) -> str:
        return self._provider.id

    async def get_route(
        self,
        origin: Coordinate,
        destination: Coordinate,
        waypoints: list[Coordinate] | None = None,
    ) -> RouteResponse:
        cache_key = build_cache_key(self._provider.id, origin, destination, waypoints)

        cached = await self._read_cache(cache_key)

        if cached is not None:
            return RouteResponse(
                coordinates=cached.coordinates,
                distance_meters=cached.distance_meters,
                duration_seconds=cached.duration_seconds,
                steps=cached.steps,
                provider=self._provider.id,
                cached=True,
            )

        route = await self._provider.get_route(origin, destination, waypoints or None)

        await self._write_cache(cache_key, origin=origin, destination=destination, route=route)

        return RouteResponse(
            coordinates=route.coordinates,
            distance_meters=route.distance_meters,
            duration_seconds=route.duration_seconds,
            steps=route.steps,
            provider=self._provider.id,
            cached=False,
        )

    async def _read_cache(self, cache_key: str):
        try:
            return await self._cache.get(cache_key)
        except DatabaseUnavailable as error:
            logger.warning("Cache de rotas indisponível na leitura: %s", error.message)
            return None

    async def _write_cache(self, cache_key: str, **kwargs) -> None:
        try:
            await self._cache.put(cache_key, provider_id=self._provider.id, **kwargs)
        except DatabaseUnavailable as error:
            logger.warning("Cache de rotas indisponível na escrita: %s", error.message)
