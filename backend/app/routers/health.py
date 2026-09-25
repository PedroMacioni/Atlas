"""Rota de diagnóstico: diz se a API, o banco e os modelos estão funcionando."""

from typing import Any

from fastapi import APIRouter, Request

from app.core.dependencies import DatabaseDep, ProviderDep, SettingsDep
from app.core.errors import DatabaseUnavailable
from app.schemas.health import HealthResponse

router = APIRouter(tags=["diagnóstico"])

API_VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health(
    request: Request,
    database: DatabaseDep,
    provider: ProviderDep,
    settings: SettingsDep,
) -> HealthResponse:
    """
    Responde 200 mesmo com o banco fora do ar.

    Sem banco a API perde o cache e os lugares salvos, mas ainda calcula rotas.
    Nesse caso o status é `degraded`.

    Também informa o estado dos três modelos de IA, que a tela inicial do app
    pode mostrar (CA-01).
    """
    try:
        await database.ping()
        database_is_up = True
    except DatabaseUnavailable:
        database_is_up = False

    return HealthResponse(
        status="ok" if database_is_up else "degraded",
        version=API_VERSION,
        environment=settings.environment,
        route_provider=provider.id,
        database=database_is_up,
        model=model.version if (model := request.app.state.decision_model) else None,
        vision=_loading_state(request.app.state.scene_classifier),
        voice_emotion=_loading_state(request.app.state.emotion_classifier),
    )


def _loading_state(classifier: Any | None) -> str:
    """`off` = desligado, `ready` = pronto, `loading` = ainda carregando."""
    if classifier is None:
        return "off"
    return "ready" if classifier.ready else "loading"
