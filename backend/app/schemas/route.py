"""
Rotas. Espelha `features/routing/types/route-result.ts`.

`coordinates`, `distanceMeters` e `durationSeconds` saem com exatamente esses
nomes no JSON — é o `RouteResult` que a interface do Atlas já conhece. Os dois
campos extras (`provider`, `cached`) são aditivos: dizem de onde a rota veio,
e um cliente que os ignore continua funcionando.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.base import ApiModel
from app.schemas.coordinate import Coordinate


class RouteRequest(BaseModel):
    """Corpo de `POST /v1/routes`."""

    origin: Coordinate
    destination: Coordinate


class ManeuverType(StrEnum):
    """
    Tipo de manobra, normalizado a partir do vocabulário do OSRM.

    A API devolve o **tipo**, e não a frase: quem monta "vire à direita na Rua
    X" é o aplicativo, porque isso é texto de interface — depende do idioma, do
    espaço na tela e de o trecho ter nome ou não. O servidor entrega o dado.

    Tipos que não caem em nenhum destes viram `CONTINUE`, que é sempre uma
    instrução segura: seguir em frente nunca manda o motorista para o lugar
    errado.

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
    """Para que lado, quando o tipo sozinho não basta."""

    LEFT = "left"
    RIGHT = "right"
    SHARP_LEFT = "sharp-left"
    SHARP_RIGHT = "sharp-right"
    SLIGHT_LEFT = "slight-left"
    SLIGHT_RIGHT = "slight-right"
    STRAIGHT = "straight"
    UTURN = "uturn"


class RouteStep(ApiModel):
    """Uma manobra do trajeto, posicionada sobre a rota."""

    type: ManeuverType
    modifier: ManeuverModifier | None = None
    # Via em que o motorista entra depois da manobra. Vazia em alças e
    # retornos sem nome, e o aplicativo omite o trecho "na ..." nesse caso.
    road_name: str = ""
    # Distância, desde o início da rota, até o ponto onde a manobra acontece.
    # É assim — e não como "distância do step" — para que o aplicativo saiba a
    # que falta apenas subtraindo o quanto já percorreu.
    distance_along_route_meters: float = Field(ge=0)
    # Onde a manobra acontece, para desenhar no mapa quando fizer sentido.
    location: Coordinate


class RouteResponse(ApiModel):
    """O `RouteResult` do aplicativo, mais a procedência da resposta."""

    coordinates: list[Coordinate] = Field(min_length=2)
    distance_meters: float = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    # Manobras do trajeto, em ordem. Vazia quando o provider não as fornece —
    # um cliente que as ignore continua funcionando.
    steps: list[RouteStep] = Field(default_factory=list)
    # Identificador do provider que calculou o trajeto ('osrm-public-demo').
    provider: str
    # `true` quando a rota veio do cache em vez do provider externo.
    cached: bool
