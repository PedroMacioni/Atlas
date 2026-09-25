"""
Lugares próximos (RF-07, RF-08, RF-19, RF-24): os mais perto, com
distância, tempo estimado e nota.
"""

from enum import StrEnum

from app.schemas.base import ApiModel


class NearbyCategory(StrEnum):
    """As 5 categorias da tela (RF-07) e mais duas usadas pelas recomendações."""

    POSTO = "posto"
    RESTAURANTE = "restaurante"
    HOTEL = "hotel"
    PONTO_TURISTICO = "ponto_turistico"
    HOSPITAL = "hospital"
    # DESCANSAR: procura posto ou hotel.
    DESCANSO = "descanso"
    # FAZER UMA PARADA: procura um lugar para pausa.
    PARADA = "parada"


class NearbyPlace(ApiModel):
    id: str
    name: str
    address: str | None = None
    latitude: float
    longitude: float
    # Distância e tempo de carro (calculados pelo OSRM). Se não der para
    # calcular o trajeto, a distância é em linha reta e o tempo fica `null`.
    distance_meters: float
    duration_seconds: float | None = None
    by_road: bool
    # Nota de 1 a 5 e número de avaliações. `null` quando a fonte não tem nota.
    rating: float | None = None
    rating_count: int | None = None


class NearbyResponse(ApiModel):
    category: NearbyCategory
    # De onde vieram os lugares: `google-places`, `tomtom` ou `openstreetmap`.
    source: str
    # Preenchido quando a fonte preferida falhou e foi usada outra.
    fallback_reason: str | None = None
    places: list[NearbyPlace]
