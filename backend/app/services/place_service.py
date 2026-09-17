"""
Catálogo de lugares.

Hoje é uma fachada fina sobre o repositório, e é isso que se quer: quando o
Google Places entrar, ele entra aqui — o banco passa a guardar os lugares
salvos do usuário e o Places responde pela descoberta, sem que o router ou o
aplicativo percebam a diferença.
"""

from app.core.errors import PlaceNotFound
from app.repositories.place_repository import PlaceRepository
from app.schemas.place import Place, PlaceCategory, PlaceListResponse


class PlaceService:
    def __init__(self, repository: PlaceRepository) -> None:
        self._repository = repository

    async def search(
        self,
        *,
        query: str | None,
        category: PlaceCategory | None,
        limit: int,
    ) -> PlaceListResponse:
        places = await self._repository.list_places(query=query, category=category, limit=limit)
        return PlaceListResponse(places=places, count=len(places))

    async def get(self, place_id: str) -> Place:
        place = await self._repository.get_place(place_id)

        if place is None:
            raise PlaceNotFound(f"Nenhum lugar com o identificador '{place_id}'.")

        return place
