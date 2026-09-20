"""
Opções próximas (RF-07, RF-08, RF-19, RF-24): as 3 mais perto, com distância,
tempo estimado e nota.
"""

from enum import StrEnum

from app.schemas.base import ApiModel


class NearbyCategory(StrEnum):
    """As 5 categorias visuais do escopo (RF-07), mais duas das decisões (§4.7)."""

    POSTO = "posto"
    RESTAURANTE = "restaurante"
    HOTEL = "hotel"
    PONTO_TURISTICO = "ponto_turistico"
    HOSPITAL = "hospital"
    # DESCANSAR: "buscar posto ou hotel próximo".
    DESCANSO = "descanso"
    # FAZER UMA PARADA: "buscar local adequado para pausa".
    PARADA = "parada"


class NearbyPlace(ApiModel):
    id: str
    name: str
    address: str | None = None
    latitude: float
    longitude: float
    # Distância e tempo **de carro**, pelo OSRM. Sem trajeto calculável, a
    # distância é em linha reta e o tempo fica `null`.
    distance_meters: float
    duration_seconds: float | None = None
    by_road: bool
    # Nota de 1 a 5 e quantas avaliações a sustentam. `null` quando a fonte
    # não tem nota — TomTom e OpenStreetMap.
    rating: float | None = None
    rating_count: int | None = None


class NearbyResponse(ApiModel):
    category: NearbyCategory
    # `google-places`, `tomtom` ou `openstreetmap`: de onde vieram os lugares.
    source: str
    # Preenchido quando a fonte preferida não respondeu e a lista veio de outra.
    fallback_reason: str | None = None
    places: list[NearbyPlace]
