"""
Montagem das dependências.

Os objetos de longa vida — o cliente HTTP de saída, o cliente do Supabase, o
provider de rotas — nascem uma vez no `lifespan` e ficam no estado do
aplicativo. Os routers pedem o que precisam por `Depends`, e nenhum deles
conhece `httpx`, URL de serviço ou chave de API.
"""

from typing import Annotated

from fastapi import Depends, Request

from app.core.config import Settings, get_settings
from app.core.database import SupabaseRest
from app.providers.base import RouteProvider
from app.repositories.place_repository import PlaceRepository
from app.repositories.route_cache_repository import RouteCacheRepository
from app.services.place_service import PlaceService
from app.services.route_service import RouteService


def get_database(request: Request) -> SupabaseRest:
    return request.app.state.database


def get_route_provider(request: Request) -> RouteProvider:
    return request.app.state.route_provider


SettingsDep = Annotated[Settings, Depends(get_settings)]
DatabaseDep = Annotated[SupabaseRest, Depends(get_database)]
ProviderDep = Annotated[RouteProvider, Depends(get_route_provider)]


def get_place_service(database: DatabaseDep) -> PlaceService:
    return PlaceService(PlaceRepository(database))


def get_route_service(
    database: DatabaseDep,
    provider: ProviderDep,
    settings: SettingsDep,
) -> RouteService:
    cache = RouteCacheRepository(database, settings.route_cache_ttl_seconds)
    return RouteService(provider, cache)


PlaceServiceDep = Annotated[PlaceService, Depends(get_place_service)]
RouteServiceDep = Annotated[RouteService, Depends(get_route_service)]
