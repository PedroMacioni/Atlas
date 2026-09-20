"""Diagnóstico — o primeiro endpoint que qualquer deploy precisa responder."""

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
    Responde 200 mesmo com o banco fora.

    A distinção é proposital: sem Supabase a API perde o catálogo e o cache,
    mas continua calculando rotas. `degraded` diz exatamente isso, e um
    balanceador pode decidir se ainda quer mandar tráfego.

    O estado dos três modelos vem junto porque é o que a tela inicial do
    aplicativo mostra: "conexão com a IA" (CA-01) é uma pergunta que só esta
    resposta sabe responder.
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
    """`off` quando não existe, `ready` quando já carregou, `loading` no meio."""
    if classifier is None:
        return "off"
    return "ready" if classifier.ready else "loading"
