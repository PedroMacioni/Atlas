"""
Viagens, diário de bordo e histórico.

As listas de emoções, classes de imagem e decisões seguem o escopo (§4) e
são as mesmas aceitas pelo banco (CHECK nas tabelas).
"""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel
from app.schemas.coordinate import Coordinate


class Emotion(StrEnum):
    CANSADO = "cansado"
    NEUTRO = "neutro"
    ANIMADO = "animado"
    TENSO = "tenso"
    BRAVO = "bravo"


class ImageClass(StrEnum):
    ESTRADA = "estrada"
    POSTO = "posto"
    RESTAURANTE = "restaurante"
    PONTO_TURISTICO = "ponto_turistico"


class Decision(StrEnum):
    CONTINUAR = "continuar"
    DESCANSAR = "descansar"
    ABASTECER = "abastecer"
    ALIMENTAR = "alimentar"
    REGISTRAR_PONTO_TURISTICO = "registrar_ponto_turistico"
    FAZER_PARADA = "fazer_parada"


class EventKind(StrEnum):
    TRIP_STARTED = "trip_started"
    TRIP_ENDED = "trip_ended"
    STOP = "stop"
    COMMAND = "command"
    RECOMMENDATION = "recommendation"
    TOURIST_SPOT = "tourist_spot"
    EMERGENCY = "emergency"
    # Leitura automática da câmera: só a classe fica, a foto não (RF-22).
    SCENE = "scene"


class EndReason(StrEnum):
    """As três formas de encerrar uma viagem (RF-25, CA-13)."""

    ARRIVAL = "arrival"
    BUTTON = "button"
    VOICE = "voice"


class NamedPoint(Coordinate):
    name: str = Field(min_length=1, max_length=200)


# --- Pedidos ---------------------------------------------------------------


class TripCreateRequest(ApiModel):
    origin: NamedPoint
    destination: NamedPoint


class EventCreateRequest(ApiModel):
    """
    Um evento do diário enviado pelo app. Início, fim e parada têm rotas
    próprias, para não haver dois jeitos de fazer a mesma coisa.
    """

    kind: EventKind
    occurred_at: datetime | None = None
    location: Coordinate | None = None
    command: str | None = Field(default=None, max_length=200)
    emotion: Emotion | None = None
    emotion_confidence: float | None = Field(default=None, ge=0, le=1)
    image_class: ImageClass | None = None
    image_confidence: float | None = Field(default=None, ge=0, le=1)
    decision: Decision | None = None
    justification: str | None = Field(default=None, max_length=1000)


class StopCreateRequest(ApiModel):
    location: Coordinate
    name: str = Field(default="Parada", min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=60)
    reason: str | None = Field(default=None, max_length=500)
    occurred_at: datetime | None = None


class TripFinishRequest(ApiModel):
    end_reason: EndReason
    ended_at: datetime | None = None
    # Distância percorrida de verdade, somada pelo app com o GPS.
    distance_meters: float = Field(ge=0)
    # Trajeto percorrido, para o mapa do resumo. Tem limite de pontos para o corpo não ficar enorme.
    path: list[Coordinate] = Field(default_factory=list, max_length=20_000)
    location: Coordinate | None = None


# --- Respostas -------------------------------------------------------------


class TripEvent(ApiModel):
    id: UUID
    kind: EventKind
    occurred_at: datetime
    location: Coordinate | None = None
    command: str | None = None
    emotion: Emotion | None = None
    emotion_confidence: float | None = None
    image_class: ImageClass | None = None
    image_confidence: float | None = None
    decision: Decision | None = None
    justification: str | None = None


class Stop(ApiModel):
    id: UUID
    position: int
    name: str
    category: str | None = None
    reason: str | None = None
    location: Coordinate
    created_at: datetime


class TripCard(ApiModel):
    """Card do histórico (RF-28)."""

    id: UUID
    origin_name: str
    destination_name: str
    # O destino vai no card para a tela de destino mostrar os "últimos destinos".
    destination: Coordinate
    started_at: datetime
    ended_at: datetime | None = None
    end_reason: EndReason | None = None
    distance_meters: float | None = None
    duration_seconds: float | None = None
    stop_count: int = 0
    predominant_emotion: Emotion | None = None


class Photo(ApiModel):
    """Uma foto guardada no diário (RF-22, CA-14)."""

    id: UUID
    event_id: UUID
    # Link temporário para a foto no bucket privado. Expira.
    url: str
    image_class: ImageClass | None = None
    taken_at: datetime
    location: Coordinate | None = None


class TripDetail(TripCard):
    """Resumo final e detalhe do histórico (RF-26, RF-29)."""

    origin: Coordinate
    path: list[Coordinate] = Field(default_factory=list)
    stops: list[Stop] = Field(default_factory=list)
    events: list[TripEvent] = Field(default_factory=list)
    # Em ordem cronológica.
    photos: list[Photo] = Field(default_factory=list)
    # "Maior trecho sem parada" (§7.2), em segundos. `null` enquanto a viagem não terminou.
    longest_stretch_without_stop_seconds: float | None = None


class TripListResponse(ApiModel):
    trips: list[TripCard]
    count: int
