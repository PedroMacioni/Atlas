"""
API do Atlas (FastAPI).

Funções principais:
  1. Guardar as chaves de API (Supabase, TomTom, Google) fora do aplicativo.
  2. Calcular rotas (OSRM) e guardar o resultado em cache no banco.
  3. Buscar lugares: salvos no banco, busca por texto e lugares próximos.
  4. Registrar viagens, diário de bordo, paradas e histórico.
  5. Rodar os modelos de IA: Random Forest (recomendação), CLIP (imagem)
     e wav2vec2 (emoção na voz).

As rotas públicas ficam sob o prefixo `/v1`, para permitir versões futuras.
"""

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import SecretStr

from app.audio.emotion_classifier import Wav2VecEmotionClassifier
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
# Em nível INFO o httpx mostra cada URL chamada, e a URL da TomTom leva a
# chave. Por isso ele só mostra avisos e erros.
logging.getLogger("httpx").setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Cria os objetos que vivem enquanto a API estiver no ar e os fecha no final.

    Usamos um único cliente HTTP para todas as chamadas externas: ele reaproveita
    as conexões, o que deixa cada chamada bem mais rápida.
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
    app.state.emotion_classifier = _emotion_classifier(settings)

    google_key = _secret(settings.google_places_api_key)
    tomtom_key = _secret(settings.tomtom_api_key)

    # Um limite diário só para a TomTom: a cota do plano soma busca e próximos.
    app.state.tomtom_budget = DailyBudget(settings.tomtom_daily_limit)
    app.state.place_search = TomTomPlaceSearch(outbound, tomtom_key) if tomtom_key else None

    app.state.nearby_service = NearbyService(
        sources=_nearby_sources(settings, outbound, app.state.tomtom_budget),
        fallback=OverpassProvider(outbound, str(settings.overpass_url)),
        router=app.state.route_provider,
    )

    logging.getLogger("atlas.api").info(
        "Atlas API pronta — ambiente=%s provider=%s próximos=%s busca=%s"
        " modelo=%s câmera=%s voz=%s",
        settings.environment,
        app.state.route_provider.id,
        "+".join([*(["google"] if google_key else []), *(["tomtom"] if tomtom_key else []), "osm"]),
        "catálogo+tomtom" if tomtom_key else "catálogo",
        app.state.decision_model.version if app.state.decision_model else "ausente",
        settings.vision_model if app.state.scene_classifier else "desligada",
        settings.voice_emotion_model if app.state.emotion_classifier else "desligada",
    )

    try:
        yield
    finally:
        await outbound.aclose()
        await database.aclose()


def _scene_classifier(settings) -> ClipSceneClassifier | None:
    """
    Classificador de imagem (CLIP), carregado em segundo plano.

    O modelo demora para abrir (e para baixar na primeira vez). A API sobe na
    hora e, até o modelo ficar pronto, a câmera responde `vision_unavailable`.
    """
    if not settings.vision_enabled:
        return None

    classifier = ClipSceneClassifier(settings.vision_model)
    classifier.load_in_background()
    return classifier


def _emotion_classifier(settings) -> Wav2VecEmotionClassifier | None:
    """Modelo de emoção na voz, também carregado em segundo plano."""
    if not settings.voice_emotion_enabled:
        return None

    classifier = Wav2VecEmotionClassifier(settings.voice_emotion_model)
    classifier.load_in_background()
    return classifier


def _secret(value: SecretStr | None) -> str | None:
    """Devolve a chave como texto, ou `None` se estiver vazia no `.env`."""
    return value.get_secret_value() if value and value.get_secret_value() else None


def _nearby_sources(
    settings: Settings, outbound: httpx.AsyncClient, tomtom_budget: DailyBudget
) -> list[NearbySource]:
    """Fontes de lugares próximos, em ordem de preferência (Google, depois TomTom)."""
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
        # Sem DELETE nem PATCH: o histórico não é apagado pelo app (RF-30), e
        # encerrar uma viagem é um POST.
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
