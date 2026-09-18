"""
Viagens: início, diário de bordo, paradas, encerramento e histórico.

Toda rota exige o cabeçalho `X-Atlas-Device` — o UUID anônimo do aparelho. Não
há DELETE: o histórico é mantido por tempo indeterminado (RF-30).
"""

from uuid import UUID

from fastapi import APIRouter, status

from app.core.dependencies import DeviceDep, TripServiceDep
from app.schemas.trip import (
    EventCreateRequest,
    Stop,
    StopCreateRequest,
    TripCreateRequest,
    TripDetail,
    TripEvent,
    TripFinishRequest,
    TripListResponse,
)

router = APIRouter(prefix="/v1/trips", tags=["viagens"])

_NOT_FOUND = {404: {"description": "Viagem inexistente ou de outro aparelho."}}
_FINISHED = {409: {"description": "A viagem já foi encerrada."}}


@router.post("", response_model=TripDetail, status_code=status.HTTP_201_CREATED)
async def start_trip(
    payload: TripCreateRequest, device: DeviceDep, service: TripServiceDep
) -> TripDetail:
    """Abre uma viagem e registra o primeiro evento do diário."""
    return await service.start(device, payload)


@router.get("", response_model=TripListResponse)
async def list_trips(device: DeviceDep, service: TripServiceDep) -> TripListResponse:
    """Histórico do aparelho, da mais recente para a mais antiga (RF-28)."""
    return await service.history(device)


@router.get("/{trip_id}", response_model=TripDetail, responses=_NOT_FOUND)
async def get_trip(trip_id: UUID, device: DeviceDep, service: TripServiceDep) -> TripDetail:
    """Resumo e detalhe: trajeto, paradas e diário de bordo (RF-26, RF-29)."""
    return await service.get(device, trip_id)


@router.post(
    "/{trip_id}/events",
    response_model=TripEvent,
    status_code=status.HTTP_201_CREATED,
    responses={**_NOT_FOUND, **_FINISHED},
)
async def record_event(
    trip_id: UUID, payload: EventCreateRequest, device: DeviceDep, service: TripServiceDep
) -> TripEvent:
    """Acrescenta um evento ao diário — comando, emergência, recomendação."""
    return await service.record_event(device, trip_id, payload)


@router.post(
    "/{trip_id}/stops",
    response_model=Stop,
    status_code=status.HTTP_201_CREATED,
    responses={**_NOT_FOUND, **_FINISHED},
)
async def add_stop(
    trip_id: UUID, payload: StopCreateRequest, device: DeviceDep, service: TripServiceDep
) -> Stop:
    """"Registrar parada": grava a parada e o evento correspondente no diário."""
    return await service.add_stop(device, trip_id, payload)


@router.post(
    "/{trip_id}/finish",
    response_model=TripDetail,
    responses={**_NOT_FOUND, **_FINISHED},
)
async def finish_trip(
    trip_id: UUID, payload: TripFinishRequest, device: DeviceDep, service: TripServiceDep
) -> TripDetail:
    """Encerra a viagem e devolve o resumo final."""
    return await service.finish(device, trip_id, payload)
