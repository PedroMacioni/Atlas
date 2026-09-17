"""Ponto geográfico. Espelha `features/map/types/coordinate.ts`."""

from pydantic import BaseModel, ConfigDict, Field


class Coordinate(BaseModel):
    """Grau decimal, WGS 84 — o mesmo formato que a `Polyline` consome."""

    model_config = ConfigDict(frozen=True)

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
