"""
API do Atlas.

Três responsabilidades, nesta fase:

  1. **Guardar as chaves.** Nenhuma credencial de Supabase ou de provider de
     rotas precisa existir dentro do aplicativo.
  2. **Absorver o provider externo.** O app pede uma rota à API; a API decide
     se responde do cache ou se chama o OSRM. Trocar de provider deixa de ser
     um release na loja.
  3. **Servir os lugares.** Os salvos vêm do banco; a busca livre e as
     opções próximas, da TomTom, com o OpenStreetMap de reserva.

Autenticação, histórico de viagens e o modelo de previsão são as fases
seguintes. O contrato de hoje foi desenhado para recebê-los sem quebrar:
`RouteResponse` já carrega `provider` e `cached`, e o versionamento por
prefixo (`/v1`) deixa espaço para evoluir sem romper clientes instalados.
"""

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import SecretStr

from app.core.config import Settings, get_settings
from app.core.database import SupabaseRest
from app.core.errors import register_error_handlers
from app.ml.model import DecisionModel
from app.providers.nearby import GooglePlacesProvider, OverpassProvider
from app.providers.osrm import OsrmRouteProvider
from app.providers.tomtom import TomTomNearbyProvider, TomTomPlaceSearch
from app.routers import health, nearby, places, recommendations, routes, trips
from app.services.daily_budget import DailyBudget
from app.services.nearby_service import NearbyService, NearbySource
from app.vision.scene_classifier import ClipSceneClassifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
)
# Em INFO o `httpx` registra cada URL chamada, e a da TomTom leva a chave na
# query string.
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Abre os clientes de saída uma vez e os fecha no encerramento.

    Um `AsyncClient` por processo, não um por requisição: é ele que mantém as
    conexões vivas e o pool de TLS, e é o que faz a diferença entre uma chamada
    de rota de 80 ms e uma de 400 ms.
    """
    settings = get_settings()

    outbound = httpx.AsyncClient(
        timeout=settings.outbound_timeout_seconds,
        headers={"accept": "application/json", "user-agent": "atlas-api/0.1"},
    )
    database = SupabaseRest(settings)

    app.state.settings = settings
    app.state.outbound = outbound
    app.state.database = database
    app.state.route_provider = OsrmRouteProvider(outbound, str(settings.osrm_base_url))
    app.state.decision_model = DecisionModel.load(settings.ml_model_path)
    app.state.scene_classifier = _scene_classifier(settings)

    google_key = _secret(settings.google_places_api_key)
    tomtom_key = _secret(settings.tomtom_api_key)

    # Um limite só para a TomTom: a cota do plano soma as duas buscas.
    app.state.tomtom_budget = DailyBudget(settings.tomtom_daily_limit)
    app.state.place_search = TomTomPlaceSearch(outbound, tomtom_key) if tomtom_key else None

    app.state.nearby_service = NearbyService(
        sources=_nearby_sources(settings, outbound, app.state.tomtom_budget),
        fallback=OverpassProvider(outbound, str(settings.overpass_url)),
        router=app.state.route_provider,
    )

    logging.getLogger("atlas.api").info(
        "Atlas API pronta — ambiente=%s provider=%s próximos=%s busca=%s modelo=%s câmera=%s",
        settings.environment,
        app.state.route_provider.id,
        "+".join([*(["google"] if google_key else []), *(["tomtom"] if tomtom_key else []), "osm"]),
        "catálogo+tomtom" if tomtom_key else "catálogo",
        app.state.decision_model.version if app.state.decision_model else "ausente",
        settings.vision_model if app.state.scene_classifier else "desligada",
    )

    try:
        yield
    finally:
        await outbound.aclose()
        await database.aclose()


def _scene_classifier(settings) -> ClipSceneClassifier | None:
    """
    O classificador de imagem, carregando numa thread.

    O CLIP leva alguns segundos para abrir — e minutos na primeira vez, quando
    ainda baixa o modelo. Nada disso pode atrasar a subida da API: até ficar
    pronto, a câmera responde `vision_unavailable` e o resto da viagem segue.
    """
    if not settings.vision_enabled:
        return None

    classifier = ClipSceneClassifier(settings.vision_model)
    classifier.load_in_background()
    return classifier


def _secret(value: SecretStr | None) -> str | None:
    """A chave em texto, ou `None` quando ausente ou vazia no `.env`."""
    return value.get_secret_value() if value and value.get_secret_value() else None


def _nearby_sources(
    settings: Settings, outbound: httpx.AsyncClient, tomtom_budget: DailyBudget
) -> list[NearbySource]:
    """As fontes principais das opções próximas, na ordem de preferência."""
    sources = []

    if google_key := _secret(settings.google_places_api_key):
        sources.append(
            NearbySource(
                GooglePlacesProvider(outbound, google_key),
                "Google Places",
                DailyBudget(settings.google_places_daily_limit),
            )
        )

    if tomtom_key := _secret(settings.tomtom_api_key):
        sources.append(
            NearbySource(TomTomNearbyProvider(outbound, tomtom_key), "TomTom", tomtom_budget)
        )

    return sources


def create_app() -> FastAPI:
    app = FastAPI(
        title="Atlas API",
        version=health.API_VERSION,
        summary="Rotas, lugares e chaves de API fora do aplicativo.",
        lifespan=lifespan,
    )

    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_methods=["GET", "POST"],
        # Sem DELETE nem PATCH de propósito: o histórico não é apagado pelo
        # aplicativo (RF-30), e encerrar uma viagem é um POST de ação.
        allow_headers=["*"],
    )

    register_error_handlers(app)

    app.include_router(health.router)
    app.include_router(places.router)
    app.include_router(nearby.router)
    app.include_router(routes.router)
    app.include_router(trips.router)
    app.include_router(recommendations.router)

    return app


app = create_app()
