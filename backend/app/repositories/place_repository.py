"""
Leitura do catálogo de lugares.

A busca por texto acontece **no banco**, pela função `search_places`, e não em
memória: é a mesma regra de `features/destination/utils/filter-places.ts` —
insensível a acento e a caixa, "sao paulo" encontra "São Paulo" — só que agora
escalável para além dos oito registros de demonstração, e sem o termo do
usuário nunca tocar a sintaxe de uma query.
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
