"""
Catálogo de destinos.

Substitui `features/destination/constants/demo-places.ts`: a tela "Definir
destino" passa a receber os lugares da API, com a busca e o filtro resolvidos
no banco. Os nomes dos campos são os mesmos do tipo `Place` do aplicativo.
"""

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.core.dependencies import PlaceServiceDep
from app.schemas.place import Place, PlaceCategory, PlaceListResponse

router = APIRouter(prefix="/v1/places", tags=["lugares"])


@router.get("", response_model=PlaceListResponse)
async def list_places(
    service: PlaceServiceDep,
    query: Annotated[
        str | None,
        Query(
            max_length=120,
            description="Termo de busca. Insensível a acento e a caixa.",
            examples=["sao paulo"],
        ),
    ] = None,
    category: Annotated[
        PlaceCategory | None,
        Query(description="Filtro de categoria, como as pílulas da tela."),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PlaceListResponse:
    """Lista lugares, com busca e filtro opcionais. Salvos vêm primeiro."""
    return await service.search(query=query, category=category, limit=limit)


@router.get("/{place_id}", response_model=Place)
async def get_place(
    service: PlaceServiceDep,
    place_id: Annotated[str, Path(max_length=120, examples=["viracopos"])],
) -> Place:
    """Um lugar pelo identificador — útil para retomar uma viagem por link."""
    return await service.get(place_id)
