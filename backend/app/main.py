"""
API do Atlas.

Três responsabilidades, nesta fase:

  1. **Guardar as chaves.** Nenhuma credencial de Supabase ou de provider de
     rotas precisa existir dentro do aplicativo.
  2. **Absorver o provider externo.** O app pede uma rota à API; a API decide
     se responde do cache ou se chama o OSRM. Trocar de provider deixa de ser
     um release na loja.
  3. **Servir o catálogo de lugares.** A lista de demonstração sai do bundle e
     vira dado, com busca e filtro no banco.

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

from app.core.config import get_settings
from app.core.database import SupabaseRest
from app.core.errors import register_error_handlers
from app.providers.osrm import OsrmRouteProvider
from app.routers import health, places, routes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
)


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

    logging.getLogger("atlas.api").info(
        "Atlas API pronta — ambiente=%s provider=%s",
        settings.environment,
        app.state.route_provider.id,
    )

    try:
        yield
    finally:
        await outbound.aclose()
        await database.aclose()


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
        allow_headers=["*"],
    )

    register_error_handlers(app)

    app.include_router(health.router)
    app.include_router(places.router)
    app.include_router(routes.router)

    return app


app = create_app()
