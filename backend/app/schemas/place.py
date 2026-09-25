"""
Lugares da busca de destino. Mesmos campos do tipo `Place` do aplicativo,
para o app usar a resposta direto.
"""

from enum import StrEnum

from pydantic import Field

from app.schemas.base import ApiModel


class PlaceCategory(StrEnum):
    FUEL = "fuel"
    FOOD = "food"
    PARKING = "parking"
    SAVED = "saved"
    # Resultado da busca externa que não é posto, comida nem estacionamento
    # (um shopping, uma faculdade, um endereço). Nunca vem do banco.
    OTHER = "other"


class Place(ApiModel):
    id: str
    name: str
    address: str
    category: PlaceCategory
    saved: bool = False
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PlaceListResponse(ApiModel):
    places: list[Place]
    # Quantidade de lugares na lista.
    count: int
