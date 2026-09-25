"""
Lugares próximos: as categorias da tela (RF-07, RF-08), o hospital da
emergência (RF-24) e os locais de uma recomendação aceita (RF-19).
"""

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.dependencies import NearbyServiceDep
from app.schemas.coordinate import Coordinate
from app.schemas.nearby import NearbyCategory, NearbyResponse
from app.services.nearby_service import DEFAULT_RESULTS, MAX_RESULTS

router = APIRouter(prefix="/v1/nearby", tags=["lugares próximos"])


@router.get("", response_model=NearbyResponse)
async def nearby(
    service: NearbyServiceDep,
    category: NearbyCategory,
    latitude: Annotated[float, Query(ge=-90, le=90)],
    longitude: Annotated[float, Query(ge=-180, le=180)],
    limit: Annotated[
        int,
        Query(ge=1, le=MAX_RESULTS, description="Quantas opções. O escopo pede 3 (RF-08)."),
    ] = DEFAULT_RESULTS,
) -> NearbyResponse:
    """
    Devolve os `limit` lugares mais próximos de carro, com distância, tempo e nota.

    `source` diz de onde vieram: `google-places` (com nota), `tomtom` ou
    `openstreetmap` (sem nota). `fallbackReason` explica por que a fonte
    preferida não foi usada.
    """
    return await service.search(category, Coordinate(latitude=latitude, longitude=longitude), limit)
