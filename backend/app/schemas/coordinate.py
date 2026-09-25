"""Ponto geográfico (latitude e longitude). Igual ao tipo `Coordinate` do app."""

from pydantic import BaseModel, ConfigDict, Field


class Coordinate(BaseModel):
    """Coordenada em graus decimais (padrão WGS 84)."""

    model_config = ConfigDict(frozen=True)

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
