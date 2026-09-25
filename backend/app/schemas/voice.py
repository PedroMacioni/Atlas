"""Comando de voz com emoção (RF-15, CA-07): resposta de `/v1/trips/{id}/voice`."""

from uuid import UUID

from app.schemas.base import ApiModel
from app.schemas.trip import Emotion


class VoiceCommandResponse(ApiModel):
    """O evento gravado e a emoção que o modelo ouviu na voz."""

    event_id: UUID
    transcript: str | None = None
    # `null` quando não deu para ler a emoção (`reason` diz por quê).
    emotion: Emotion | None = None
    confidence: float | None = None
    # Os três valores do modelo, de 0 a 1, que explicam a emoção escolhida (§4.1).
    arousal: float | None = None
    valence: float | None = None
    dominance: float | None = None
    # Motivo de vir sem emoção: `no_audio`, `model_off`, `model_loading` ou `invalid_audio`.
    reason: str | None = None
