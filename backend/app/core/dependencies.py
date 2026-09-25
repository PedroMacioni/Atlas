"""
Injeção de dependências do FastAPI.

Os objetos que vivem o tempo todo (cliente HTTP, banco, provider de rotas)
são criados uma vez no `lifespan` (main.py). As rotas pedem o que precisam
com `Depends` e não sabem nada de URL ou chave.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request

from app.core.config import Settings, get_settings
from app.core.database import SupabaseRest
from app.ml.model import DecisionModel
from app.providers.base import RouteProvider
from app.repositories.place_repository import PlaceRepository
from app.repositories.route_cache_repository import RouteCacheRepository
from app.repositories.trip_repository import TripRepository
from app.services.nearby_service import NearbyService
from app.services.place_service import PlaceService
from app.services.recommendation_service import RecommendationService
from app.services.route_service import RouteService
from app.services.scene_service import SceneService
from app.services.trip_service import TripService
from app.services.voice_service import VoiceService


def get_database(request: Request) -> SupabaseRest:
    return request.app.state.database


def get_route_provider(request: Request) -> RouteProvider:
    return request.app.state.route_provider


SettingsDep = Annotated[Settings, Depends(get_settings)]
DatabaseDep = Annotated[SupabaseRest, Depends(get_database)]
ProviderDep = Annotated[RouteProvider, Depends(get_route_provider)]


def get_place_service(request: Request, database: DatabaseDep) -> PlaceService:
    return PlaceService(
        PlaceRepository(database),
        external=request.app.state.place_search,
        budget=request.app.state.tomtom_budget,
    )


def get_route_service(
    database: DatabaseDep,
    provider: ProviderDep,
    settings: SettingsDep,
) -> RouteService:
    cache = RouteCacheRepository(database, settings.route_cache_ttl_seconds)
    return RouteService(provider, cache)


def get_trip_repository(database: DatabaseDep) -> TripRepository:
    return TripRepository(database)


def get_trip_service(
    repository: Annotated[TripRepository, Depends(get_trip_repository)],
    settings: SettingsDep,
) -> TripService:
    return TripService(repository, photo_url_ttl_seconds=settings.photo_url_ttl_seconds)


def get_scene_service(
    request: Request,
    repository: Annotated[TripRepository, Depends(get_trip_repository)],
    settings: SettingsDep,
) -> SceneService:
    return SceneService(
        repository,
        request.app.state.scene_classifier,
        photo_url_ttl_seconds=settings.photo_url_ttl_seconds,
    )


def get_voice_service(
    request: Request,
    repository: Annotated[TripRepository, Depends(get_trip_repository)],
) -> VoiceService:
    return VoiceService(repository, request.app.state.emotion_classifier)


def get_decision_model(request: Request) -> DecisionModel | None:
    return request.app.state.decision_model


def get_recommendation_service(
    repository: Annotated[TripRepository, Depends(get_trip_repository)],
    model: Annotated[DecisionModel | None, Depends(get_decision_model)],
    settings: SettingsDep,
) -> RecommendationService:
    return RecommendationService(
        repository, model, simulation_enabled=settings.ml_simulation_enabled
    )


def get_nearby_service(request: Request) -> NearbyService:
    return request.app.state.nearby_service


PlaceServiceDep = Annotated[PlaceService, Depends(get_place_service)]
NearbyServiceDep = Annotated[NearbyService, Depends(get_nearby_service)]
RouteServiceDep = Annotated[RouteService, Depends(get_route_service)]
TripServiceDep = Annotated[TripService, Depends(get_trip_service)]
SceneServiceDep = Annotated[SceneService, Depends(get_scene_service)]
VoiceServiceDep = Annotated[VoiceService, Depends(get_voice_service)]
RecommendationServiceDep = Annotated[RecommendationService, Depends(get_recommendation_service)]

# Identificador anônimo do aparelho, enviado no cabeçalho `X-Atlas-Device`.
# Não há login: o app gera um UUID na primeira execução. Sem ele (ou
# inválido), o pedido é recusado com `invalid_request`.
DeviceDep = Annotated[UUID, Header(alias="X-Atlas-Device")]
