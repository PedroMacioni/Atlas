"""Resposta do /health."""

from typing import Literal

from app.schemas.base import ApiModel


class HealthResponse(ApiModel):
    status: Literal["ok", "degraded"]
    version: str
    environment: str
    # Qual serviço de rotas está em uso.
    route_provider: str
    # `false` quando o banco não respondeu (sem cache e sem lugares salvos).
    database: bool
    # Estado dos três modelos de IA (CA-01).
    # Versão do Random Forest, ou `null` se ele ainda não foi treinado.
    model: str | None = None
    # Câmera (CLIP): `ready` pronto, `loading` carregando, `off` desligado.
    vision: Literal["ready", "loading", "off"] = "off"
    # O mesmo para a emoção na voz.
    voice_emotion: Literal["ready", "loading", "off"] = "off"
