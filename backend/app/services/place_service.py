"""
Busca de destino: os lugares salvos do catálogo e, atrás deles, a busca
livre da TomTom.

O catálogo vem sempre primeiro — é onde estão os lugares que o usuário
marcou, e alguns que nenhuma fonte grátis acha pelo nome. A TomTom completa a
lista quando há texto digitado; sem texto, a tela mostra só os salvos. Se a
TomTom falhar ou esgotar o limite do dia, a resposta sai só com o catálogo:
a busca fica mais pobre, nunca quebrada.
"""

import logging
from typing import Protocol

from app.core.errors import PlaceNotFound
from app.providers.tomtom import PlaceSearchUnavailable
from app.repositories.place_repository import PlaceRepository
from app.schemas.coordinate import Coordinate
from app.schemas.place import Place, PlaceCategory, PlaceListResponse
from app.services.daily_budget import DailyBudget
from app.utils.geo import distance_meters

logger = logging.getLogger("atlas.api")

# Menos que isso ainda não diz nada ("po" é posto? pousada? Porto Alegre?) e
# gastaria cota a cada tecla.
MIN_EXTERNAL_QUERY = 3
# Quantos resultados pedir à busca externa. A tela é uma lista, não um mapa.
EXTERNAL_LIMIT = 10
# Um resultado externo a menos disso de um lugar salvo é o mesmo lugar.
DUPLICATE_METERS = 150


class PlaceSearchProvider(Protocol):
    id: str

    async def search(self, query: str, near: Coordinate | None, limit: int) -> list[Place]: ...


class PlaceService:
    def __init__(
        self,
        repository: PlaceRepository,
        *,
        external: PlaceSearchProvider | None = None,
        budget: DailyBudget | None = None,
    ) -> None:
        self._repository = repository
        self._external = external
        self._budget = budget

    async def search(
        self,
        *,
        query: str | None,
        category: PlaceCategory | None,
        limit: int,
        near: Coordinate | None = None,
    ) -> PlaceListResponse:
        catalog = await self._repository.list_places(query=query, category=category, limit=limit)
        extra = await self._external_search(query, category, near)

        # Sem repetir o que o catálogo já mostra.
        extra = [
            place
            for place in extra
            if all(_distance(place, saved) > DUPLICATE_METERS for saved in catalog)
        ]

        places = (catalog + extra)[:limit]
        return PlaceListResponse(places=places, count=len(places))

    async def get(self, place_id: str) -> Place:
        place = await self._repository.get_place(place_id)

        if place is None:
            raise PlaceNotFound(f"Nenhum lugar com o identificador '{place_id}'.")

        return place

    async def _external_search(
        self, query: str | None, category: PlaceCategory | None, near: Coordinate | None
    ) -> list[Place]:
        term = (query or "").strip()

        # Um filtro de categoria é um filtro do catálogo ("Salvos").
        if self._external is None or category is not None or len(term) < MIN_EXTERNAL_QUERY:
            return []

        if self._budget and not self._budget.try_spend():
            logger.warning("Limite diário da busca de lugares atingido; só o catálogo.")
            return []

        try:
            return await self._external.search(term, near, EXTERNAL_LIMIT)
        except PlaceSearchUnavailable as error:
            logger.warning("Busca de lugares falhou, só o catálogo: %s", error)
            return []


def _distance(a: Place, b: Place) -> float:
    return distance_meters(
        Coordinate(latitude=a.latitude, longitude=a.longitude),
        Coordinate(latitude=b.latitude, longitude=b.longitude),
    )
