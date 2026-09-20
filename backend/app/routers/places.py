"""
Catálogo de destinos.

Substitui `features/destination/constants/demo-places.ts`: a tela "Definir
destino" passa a receber os lugares da API — os salvos, do banco, e com texto
digitado também os da TomTom. Os nomes dos campos são os mesmos do tipo
`Place` do aplicativo.
"""

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.core.dependencies import PlaceServiceDep
from app.schemas.coordinate import Coordinate
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
    latitude: Annotated[
        float | None,
        Query(ge=-90, le=90, description="Onde o usuário está, para preferir o que é perto."),
    ] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
) -> PlaceListResponse:
    """
    Lista lugares, com busca e filtro opcionais. Salvos vêm primeiro; com
    texto, os achados da TomTom vêm depois deles, os mais perto primeiro.
    """
    # Só uma das duas não localiza ninguém: a busca segue sem preferência.
    near = (
        Coordinate(latitude=latitude, longitude=longitude)
        if latitude is not None and longitude is not None
        else None
    )
    return await service.search(query=query, category=category, limit=limit, near=near)


@router.get("/{place_id}", response_model=Place)
async def get_place(
    service: PlaceServiceDep,
    place_id: Annotated[str, Path(max_length=120, examples=["viracopos"])],
) -> Place:
    """Um lugar pelo identificador — útil para retomar uma viagem por link."""
    return await service.get(place_id)
