"""
Leitura dos lugares salvos no banco.

A busca por texto roda no banco, na função SQL `search_places`: ignora
acentos e maiúsculas ("sao paulo" acha "São Paulo"), e o texto do usuário
vai como parâmetro, nunca montado dentro da consulta.
"""

from app.core.database import SupabaseRest
from app.schemas.place import Place, PlaceCategory

TABLE = "places"
SEARCH_FUNCTION = "search_places"

_COLUMNS = "id,name,address,category,saved,latitude,longitude"


class PlaceRepository:
    def __init__(self, database: SupabaseRest) -> None:
        self._database = database

    async def list_places(
        self,
        *,
        query: str | None = None,
        category: PlaceCategory | None = None,
        limit: int = 20,
    ) -> list[Place]:
        # "other" só existe na busca externa: no banco não há lugar assim (e o
        # tipo da coluna nem aceita esse valor).
        if category is PlaceCategory.OTHER:
            return []

        rows = await self._database.rpc(
            SEARCH_FUNCTION,
            {
                "search_query": query,
                "filter_category": category.value if category else None,
                "result_limit": limit,
            },
        )
        return [Place.model_validate(row) for row in rows]

    async def get_place(self, place_id: str) -> Place | None:
        rows = await self._database.select(
            TABLE,
            params={"select": _COLUMNS, "id": f"eq.{place_id}", "limit": 1},
        )
        return Place.model_validate(rows[0]) if rows else None
