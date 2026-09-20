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
    # Os modelos, para a tela inicial dizer se a IA está de pé (CA-01).
    # A versão do Random Forest, ou `null` se `ml/train.py` ainda não rodou.
    model: str | None = None
    # `ready` quando o CLIP já carregou, `loading` enquanto baixa ou abre,
    # `off` sem o extra `vision` ou com a câmera desligada.
    vision: Literal["ready", "loading", "off"] = "off"
