"""
Busca de lugares próximos — o contrato e duas das implementações (a terceira,
TomTom, está em `tomtom.py`, junto da busca por texto).

- **Google Places (API New)**, opcional: é a única com nota, e é o que o
  escopo define (§9.1) — mas exige cartão para liberar a chave.
- **TomTom**, grátis e sem cartão, sem nota.
- **OpenStreetMap (Overpass)**, reserva: gratuito e sem chave, entra quando
  nenhuma das outras está configurada, esgotou o limite do dia ou falhou.
  Não tem nota.

Nenhuma delas guarda resultado. Os termos do Google proíbem cachear o
conteúdo do Places (nome, nota, endereço) — só o identificador pode ser
guardado. O controle de custo é o limite diário em `nearby_service.py` e a
cota configurada no console do Google.

@see https://developers.google.com/maps/documentation/places/web-service/nearby-search
@see https://wiki.openstreetmap.org/wiki/Overpass_API
"""

from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.schemas.coordinate import Coordinate
from app.schemas.nearby import NearbyCategory


@dataclass(frozen=True)
class Candidate:
    id: str
    name: str
    address: str | None
    location: Coordinate
    rating: float | None = None
    rating_count: int | None = None


class NearbyUnavailable(Exception):
    """A fonte não respondeu — quem chama tenta a próxima."""


class NearbyProvider(Protocol):
    id: str

    async def search(
        self, category: NearbyCategory, center: Coordinate, radius_meters: float, limit: int
    ) -> list[Candidate]: ...


# --- Google Places ---------------------------------------------------------

GOOGLE_URL = "https://places.googleapis.com/v1/places:searchNearby"

# Só o que a tela usa. `rating` e `userRatingCount` puxam a consulta para o
# plano Enterprise (1.000 grátis por mês); o resto é Pro. Cada campo a mais
# além destes custa sem aparecer em lugar nenhum.
GOOGLE_FIELD_MASK = ",".join(
    (
        "places.id",
        "places.displayName",
        "places.shortFormattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
    )
)

GOOGLE_TYPES: dict[NearbyCategory, list[str]] = {
    NearbyCategory.POSTO: ["gas_station"],
    NearbyCategory.RESTAURANTE: ["restaurant"],
    NearbyCategory.HOTEL: ["lodging"],
    NearbyCategory.PONTO_TURISTICO: ["tourist_attraction"],
    NearbyCategory.HOSPITAL: ["hospital"],
    NearbyCategory.DESCANSO: ["lodging", "gas_station"],
    NearbyCategory.PARADA: ["rest_stop", "gas_station", "cafe"],
}


class GooglePlacesProvider:
    id = "google-places"

    def __init__(self, client: httpx.AsyncClient, api_key: str) -> None:
        self._client = client
        self._api_key = api_key

    async def search(
        self, category: NearbyCategory, center: Coordinate, radius_meters: float, limit: int
    ) -> list[Candidate]:
        try:
            response = await self._client.post(
                GOOGLE_URL,
                headers={
                    "X-Goog-Api-Key": self._api_key,
                    "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
                },
                json={
                    "includedTypes": GOOGLE_TYPES[category],
                    "maxResultCount": limit,
                    "rankPreference": "DISTANCE",
                    "languageCode": "pt-BR",
                    "regionCode": "BR",
                    "locationRestriction": {
                        "circle": {
                            "center": {
                                "latitude": center.latitude,
                                "longitude": center.longitude,
                            },
                            "radius": radius_meters,
                        }
                    },
                },
            )
        except httpx.HTTPError as error:
            raise NearbyUnavailable(f"Google Places sem resposta: {error}") from error

        if response.is_error:
            # 403 = chave inválida ou API não ativada; 429 = cota do console.
            raise NearbyUnavailable(
                f"Google Places respondeu {response.status_code}: {response.text[:200]}"
            )

        try:
            payload = response.json()
        except ValueError as error:
            raise NearbyUnavailable("Google Places devolveu um corpo inválido.") from error

        return [c for c in map(_google_candidate, payload.get("places") or []) if c]


def _google_candidate(raw: Any) -> Candidate | None:
    if not isinstance(raw, dict) or raw.get("businessStatus") == "CLOSED_PERMANENTLY":
        return None

    location = raw.get("location") or {}
    name = (raw.get("displayName") or {}).get("text")
    latitude, longitude = location.get("latitude"), location.get("longitude")

    if not name or not isinstance(latitude, int | float) or not isinstance(longitude, int | float):
        return None

    rating = raw.get("rating")
    count = raw.get("userRatingCount")

    return Candidate(
        id=f"google:{raw.get('id')}",
        name=name,
        address=raw.get("shortFormattedAddress"),
        location=Coordinate(latitude=latitude, longitude=longitude),
        rating=float(rating) if isinstance(rating, int | float) else None,
        rating_count=int(count) if isinstance(count, int) else None,
    )


# --- OpenStreetMap (Overpass) ----------------------------------------------

# Filtros de tag por categoria, na sintaxe do Overpass.
OSM_FILTERS: dict[NearbyCategory, list[str]] = {
    NearbyCategory.POSTO: ['["amenity"="fuel"]'],
    NearbyCategory.RESTAURANTE: ['["amenity"="restaurant"]'],
    NearbyCategory.HOTEL: ['["tourism"~"^(hotel|motel|guest_house)$"]'],
    NearbyCategory.PONTO_TURISTICO: ['["tourism"~"^(attraction|viewpoint|museum)$"]'],
    NearbyCategory.HOSPITAL: ['["amenity"="hospital"]'],
    NearbyCategory.DESCANSO: ['["tourism"~"^(hotel|motel)$"]', '["amenity"="fuel"]'],
    NearbyCategory.PARADA: ['["highway"="rest_area"]', '["amenity"~"^(fuel|cafe)$"]'],
}


# O Overpass público é compartilhado pelo mundo todo e, medido em 18/09/2026,
# levou 23 s para responder uma busca de postos em Campinas. É reserva, não
# fonte de demonstração: o prazo é longo para que a lista chegue, ainda que
# devagar, em vez de a reserva desistir antes de responder.
OVERPASS_TIMEOUT_SECONDS = 25


class OverpassProvider:
    id = "openstreetmap"

    def __init__(self, client: httpx.AsyncClient, base_url: str) -> None:
        self._client = client
        self._url = base_url

    async def search(
        self, category: NearbyCategory, center: Coordinate, radius_meters: float, limit: int
    ) -> list[Candidate]:
        around = f"(around:{int(radius_meters)},{center.latitude},{center.longitude})"
        selectors = "".join(f"nwr{tag}[name]{around};" for tag in OSM_FILTERS[category])
        # `out center` dá um ponto também para vias e áreas (um hospital
        # desenhado como polígono, por exemplo). Pede mais que o necessário
        # porque o Overpass não ordena por distância; quem ordena é o serviço.
        query = (
            f"[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];({selectors});out center {limit * 4};"
        )

        try:
            response = await self._client.post(
                self._url, data={"data": query}, timeout=OVERPASS_TIMEOUT_SECONDS + 5
            )
            payload = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise NearbyUnavailable(f"Overpass sem resposta: {error}") from error

        if response.is_error or not isinstance(payload, dict):
            raise NearbyUnavailable(f"Overpass respondeu {response.status_code}.")

        # Sobrecarregado, o Overpass responde 200 com a lista vazia e o erro
        # escondido em `remark` ("runtime error: ... timed out"). Tratar isso
        # como "nenhum lugar por perto" seria mentir para quem está na estrada.
        remark = str(payload.get("remark") or "")
        if "error" in remark.lower():
            raise NearbyUnavailable(f"Overpass com erro interno: {remark[:120]}")

        return [c for c in map(_osm_candidate, payload.get("elements") or []) if c]


def _osm_candidate(raw: Any) -> Candidate | None:
    if not isinstance(raw, dict):
        return None

    tags = raw.get("tags") or {}
    point = raw if "lat" in raw else raw.get("center") or {}
    latitude, longitude = point.get("lat"), point.get("lon")

    if not tags.get("name") or latitude is None or longitude is None:
        return None

    street = tags.get("addr:street")
    number = tags.get("addr:housenumber")
    address = f"{street}, {number}" if street and number else street

    return Candidate(
        id=f"osm:{raw.get('type')}/{raw.get('id')}",
        name=tags["name"],
        address=address,
        location=Coordinate(latitude=latitude, longitude=longitude),
    )
