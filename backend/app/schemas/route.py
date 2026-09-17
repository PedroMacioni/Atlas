"""
Rotas. Espelha `features/routing/types/route-result.ts`.

`coordinates`, `distanceMeters` e `durationSeconds` saem com exatamente esses
nomes no JSON — é o `RouteResult` que a interface do Atlas já conhece. Os dois
campos extras (`provider`, `cached`) são aditivos: dizem de onde a rota veio,
e um cliente que os ignore continua funcionando.
"""

from pydantic import BaseModel, Field

from app.schemas.base import ApiModel
from app.schemas.coordinate import Coordinate


class RouteRequest(BaseModel):
    """Corpo de `POST /v1/routes`."""

    origin: Coordinate
    destination: Coordinate


class RouteResponse(ApiModel):
    """O `RouteResult` do aplicativo, mais a procedência da resposta."""

    coordinates: list[Coordinate] = Field(min_length=2)
    distance_meters: float = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    # Identificador do provider que calculou o trajeto ('osrm-public-demo').
    provider: str
    # `true` quando a rota veio do cache em vez do provider externo.
    cached: bool
