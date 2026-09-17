"""Diagnóstico da API."""

from typing import Literal

from app.schemas.base import ApiModel


class HealthResponse(ApiModel):
    status: Literal["ok", "degraded"]
    version: str
    environment: str
    # Qual provider responde por rotas neste momento.
    route_provider: str
    # `false` quando o Supabase não respondeu — a API sobe mesmo assim, mas
    # sem cache de rotas nem catálogo de lugares.
    database: bool
