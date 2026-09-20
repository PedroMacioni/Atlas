"""
Classificação de cena (RF-16, RF-22): o que o app manda e o que recebe de
volta ao enviar uma foto.
"""

from enum import StrEnum
from uuid import UUID

from app.schemas.base import ApiModel
from app.schemas.trip import ImageClass, Photo


class ScenePurpose(StrEnum):
    """Para que a foto foi tirada — é o que decide se ela é guardada."""

    # Leitura automática da câmera: vira classe, não vira foto guardada.
    CONTEXT = "context"
    # "Registrar ponto turístico": a foto fica.
    TOURIST_SPOT = "tourist_spot"


class SceneResponse(ApiModel):
    image_class: ImageClass
    confidence: float
    # A probabilidade de cada uma das 4 classes, como o modelo as viu.
    probabilities: dict[str, float]
    # `false` quando a leitura não virou evento — cena repetida ou confiança
    # baixa demais para valer um registro.
    recorded: bool
    # `low_confidence` ou `unchanged`, quando não foi registrada.
    reason: str | None = None
    event_id: UUID | None = None
    # Só no "registrar ponto turístico".
    photo: Photo | None = None
