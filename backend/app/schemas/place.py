"""
Catálogo de destinos. Espelha `features/destination/types/place.ts`.

Os nomes dos campos são idênticos aos do TypeScript de propósito: o app
consome a resposta sem nenhuma tradução no meio.
"""

from enum import StrEnum

from pydantic import Field

from app.schemas.base import ApiModel


class PlaceCategory(StrEnum):
    FUEL = "fuel"
    FOOD = "food"
    PARKING = "parking"
    SAVED = "saved"
    # Achado na busca externa sem ser posto, comida ou estacionamento: um
    # shopping, uma faculdade, um endereço. Nunca vem do catálogo.
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
    # Quantos vieram, para a tela não precisar contar nem adivinhar se truncou.
    count: int
