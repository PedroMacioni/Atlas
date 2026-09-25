"""Formato das requisições e respostas de recomendação."""

from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.base import ApiModel
from app.schemas.coordinate import Coordinate
from app.schemas.trip import Decision, Emotion, ImageClass

# `check`: consulta periódica do app (o backend decide se já é hora).
# `manual`: "Atlas, preciso abastecer ou descansar" (sempre avalia).
# `simulation`: modo de demonstração (sempre avalia, com valores trocados).
Trigger = Literal["check", "manual", "simulation"]


class SimulationOverrides(ApiModel):
    """As 6 variáveis, todas opcionais: o que não vier usa o valor real."""

    hour: float | None = Field(default=None, ge=0, lt=24)
    trip_minutes: float | None = Field(default=None, ge=0, le=24 * 60)
    distance_km: float | None = Field(default=None, ge=0, le=3_000)
    minutes_since_stop: float | None = Field(default=None, ge=0, le=24 * 60)
    emotion: Emotion | Literal["desconhecido"] | None = None
    emotion_confidence: float | None = Field(default=None, ge=0, le=1)
    image: ImageClass | Literal["desconhecida"] | None = None


class RecommendationRequest(ApiModel):
    trigger: Trigger
    # Distância percorrida até agora (só o app sabe, somando o GPS).
    distance_meters: float = Field(ge=0)
    location: Coordinate | None = None
    simulation: SimulationOverrides | None = None

    @model_validator(mode="after")
    def _simulation_only_when_simulating(self) -> "RecommendationRequest":
        if self.simulation is not None and self.trigger != "simulation":
            raise ValueError("`simulation` só é aceito com trigger 'simulation'.")
        return self


class Contribution(ApiModel):
    variable: str
    label: str
    value: str
    # Quanto essa variável aumentou (ou diminuiu) a chance da decisão escolhida.
    weight: float


class Recommendation(ApiModel):
    id: UUID
    event_id: UUID
    decision: Decision
    label: str
    confidence: float
    justification: str
    contributions: list[Contribution]
    probabilities: dict[str, float]
    features: dict[str, float | str]
    simulated: bool
    model_version: str
    # Toda decisão diferente de CONTINUAR pede confirmação antes de mudar a rota (CA-10).
    requires_confirmation: bool


class RecommendationResponse(ApiModel):
    # `false` quando ainda não era hora de avaliar (`reason` diz o motivo).
    evaluated: bool
    # `true` quando vale a pena avisar o motorista (mostrar e falar).
    notify: bool
    reason: str | None = None
    # Tensão forte na voz: oferecer a emergência em vez de recomendar.
    assistance: bool = False
    recommendation: Recommendation | None = None


class RecommendationAnswer(ApiModel):
    accepted: bool
    location: Coordinate | None = None


class RecommendationAnswerResponse(ApiModel):
    id: UUID
    accepted: bool
