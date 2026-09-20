"""
Viagens, diário de bordo e histórico.

Os vocabulários — emoções, classes de imagem, decisões — são os do escopo
(§4) e os mesmos dos CHECKs do banco. Os modelos de IA vão escrever nestes
campos; o contrato fica declarado aqui, antes deles existirem.
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
    Um evento do diário. Só os tipos que o aplicativo registra sozinho: início,
    fim e parada nascem dos seus próprios endpoints, para não haver dois jeitos
    de encerrar uma viagem.
    """

    kind: EventKind
    occurred_at: datetime | None = None
    location: Coordinate | None = None
    command: str | None = Field(default=None, max_length=200)
    emotion: Emotion | None = None
    emotion_confidence: float | None = Field(default=None, ge=0, le=1)
    image_class: ImageClass | None = None
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
    # Distância percorrida de verdade, somada pelo aplicativo sobre o GPS.
    distance_meters: float = Field(ge=0)
    # Trajeto percorrido, para o mapa do resumo. Limitado para que uma viagem
    # longa não vire um corpo de vários megabytes.
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
    """O card do histórico (RF-28)."""

    id: UUID
    origin_name: str
    destination_name: str
    # No card, e não só no detalhe, para a tela de destino oferecer os últimos
    # destinos sem abrir viagem por viagem.
    destination: Coordinate
    started_at: datetime
    ended_at: datetime | None = None
    end_reason: EndReason | None = None
    distance_meters: float | None = None
    duration_seconds: float | None = None
    stop_count: int = 0
    predominant_emotion: Emotion | None = None


class TripDetail(TripCard):
    """Resumo final e detalhe do histórico (RF-26, RF-29)."""

    origin: Coordinate
    path: list[Coordinate] = Field(default_factory=list)
    stops: list[Stop] = Field(default_factory=list)
    events: list[TripEvent] = Field(default_factory=list)
    # "Maior trecho sem parada" do resumo (§7.2), em segundos. `null` enquanto
    # a viagem não terminou.
    longest_stretch_without_stop_seconds: float | None = None


class TripListResponse(ApiModel):
    trips: list[TripCard]
    count: int
