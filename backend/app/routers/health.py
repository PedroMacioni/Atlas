"""Diagnóstico — o primeiro endpoint que qualquer deploy precisa responder."""

from fastapi import APIRouter

from app.core.dependencies import DatabaseDep, ProviderDep, SettingsDep
from app.core.errors import DatabaseUnavailable
from app.schemas.health import HealthResponse

router = APIRouter(tags=["diagnóstico"])

API_VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health(
    database: DatabaseDep,
    provider: ProviderDep,
    settings: SettingsDep,
) -> HealthResponse:
    """
    Responde 200 mesmo com o banco fora.

    A distinção é proposital: sem Supabase a API perde o catálogo e o cache,
    mas continua calculando rotas. `degraded` diz exatamente isso, e um
    balanceador pode decidir se ainda quer mandar tráfego.
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
    )
