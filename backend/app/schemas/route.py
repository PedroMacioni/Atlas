"""
Rotas. Mesmo formato do `RouteResult` do aplicativo.

Os campos `provider` e `cached` são extras: dizem de onde veio a rota.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.base import ApiModel
from app.schemas.coordinate import Coordinate


class RouteRequest(BaseModel):
    """Corpo de `POST /v1/routes`."""

    origin: Coordinate
    destination: Coordinate
    # Paradas no meio do caminho, em ordem. Um desvio para um posto entra
    # aqui, e o destino continua o mesmo.
    waypoints: list[Coordinate] = Field(default_factory=list, max_length=5)


class ManeuverType(StrEnum):
    """
    Tipo de manobra, a partir do vocabulário do OSRM.

    A API manda só o tipo; quem monta a frase ("vire à direita na Rua X") é
    o aplicativo. Tipos desconhecidos viram `CONTINUE` (seguir em frente).

    @see https://project-osrm.org/docs/v5.24.0/api/#stepmaneuver-object
    """

    DEPART = "depart"
    ARRIVE = "arrive"
    TURN = "turn"
    CONTINUE = "continue"
    MERGE = "merge"
    ON_RAMP = "on-ramp"
    OFF_RAMP = "off-ramp"
    FORK = "fork"
    END_OF_ROAD = "end-of-road"
    ROUNDABOUT = "roundabout"
    ROTARY = "rotary"
    NEW_NAME = "new-name"


class ManeuverModifier(StrEnum):
    """Para que lado virar, quando o tipo sozinho não basta."""

    LEFT = "left"
    RIGHT = "right"
    SHARP_LEFT = "sharp-left"
    SHARP_RIGHT = "sharp-right"
    SLIGHT_LEFT = "slight-left"
    SLIGHT_RIGHT = "slight-right"
    STRAIGHT = "straight"
    UTURN = "uturn"


class RouteStep(ApiModel):
    """Uma manobra do trajeto."""

    type: ManeuverType
    modifier: ManeuverModifier | None = None
    # Nome da rua depois da manobra. Pode vir vazio (alças e retornos sem nome).
    road_name: str = ""
    # Distância desde o início da rota até a manobra. Assim o app sabe quanto
    # falta só subtraindo o quanto já andou.
    distance_along_route_meters: float = Field(ge=0)
    # Onde a manobra acontece.
    location: Coordinate


class RouteResponse(ApiModel):
    """A rota calculada, mais a informação de onde ela veio."""

    coordinates: list[Coordinate] = Field(min_length=2)
    distance_meters: float = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    # Manobras em ordem. Vazia quando o serviço de rotas não as informa.
    steps: list[RouteStep] = Field(default_factory=list)
    # Qual serviço calculou a rota (ex.: 'osrm-public-demo').
    provider: str
    # `true` quando a rota veio do cache.
    cached: bool
