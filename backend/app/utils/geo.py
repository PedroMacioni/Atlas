"""Cálculos com coordenadas (igual ao `src/utils/geo.ts` do app)."""

import math

from app.schemas.coordinate import Coordinate

EARTH_RADIUS_METERS = 6_371_008.8


def distance_meters(origin: Coordinate, target: Coordinate) -> float:
    """Distância em linha reta entre dois pontos (fórmula de Haversine)."""
    lat1, lat2 = math.radians(origin.latitude), math.radians(target.latitude)
    d_lat = lat2 - lat1
    d_lon = math.radians(target.longitude - origin.longitude)

    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(h)))
