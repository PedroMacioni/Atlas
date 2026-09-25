"""Classificação de cena (RF-16, RF-22): o que o app envia e o que recebe."""

from enum import StrEnum
from uuid import UUID

from app.schemas.base import ApiModel
from app.schemas.trip import ImageClass, Photo


class ScenePurpose(StrEnum):
    """Para que a foto foi tirada. Decide se ela é guardada ou não."""

    # Leitura automática da câmera: só a classe fica, a foto é descartada.
    CONTEXT = "context"
    # "Registrar ponto turístico": a foto é guardada.
    TOURIST_SPOT = "tourist_spot"


class SceneResponse(ApiModel):
    image_class: ImageClass
    confidence: float
    # Probabilidade de cada uma das 4 classes.
    probabilities: dict[str, float]
    # `false` quando a leitura não virou evento (cena repetida ou confiança baixa).
    recorded: bool
    # `low_confidence` ou `unchanged`, quando não foi registrada.
    reason: str | None = None
    event_id: UUID | None = None
    # Só no "registrar ponto turístico".
    photo: Photo | None = None
