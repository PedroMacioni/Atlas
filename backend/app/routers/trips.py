"""
Viagens: início, diário de bordo, paradas, encerramento e histórico.

Toda rota exige o cabeçalho `X-Atlas-Device` — o UUID anônimo do aparelho. Não
há DELETE: o histórico é mantido por tempo indeterminado (RF-30).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.core.dependencies import DeviceDep, SceneServiceDep, TripServiceDep
from app.core.errors import InvalidImageError
from app.schemas.coordinate import Coordinate
from app.schemas.scene import ScenePurpose, SceneResponse
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
    """ "Registrar parada": grava a parada e o evento correspondente no diário."""
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


# Uma foto de celular a 1280 px e qualidade média fica em algumas centenas de
# kB. 5 MB é o limite do bucket, e recusar antes de ler o arquivo inteiro
# evita que um engano ocupe a memória da API.
MAX_PHOTO_BYTES = 5 * 1024 * 1024


@router.post("/{trip_id}/scenes", response_model=SceneResponse, responses=_NOT_FOUND | _FINISHED)
async def classify_scene(
    trip_id: UUID,
    device: DeviceDep,
    service: SceneServiceDep,
    image: Annotated[UploadFile, File(description="A foto, em JPEG.")],
    purpose: Annotated[ScenePurpose, Form()] = ScenePurpose.CONTEXT,
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
) -> SceneResponse:
    """
    Classifica a cena em Estrada, Posto, Restaurante ou Ponto turístico
    (RF-16, CA-06).

    `purpose=context` é a leitura automática da câmera: vira classe no diário,
    e a foto não é guardada. `purpose=tourist_spot` é o "Registrar ponto
    turístico": a foto fica, e volta na resposta com uma URL temporária.

    `recorded=false` diz que a leitura não virou evento — a cena não mudou
    desde a anterior, ou a confiança ficou baixa demais para valer um registro.
    """
    content = await image.read()

    if not content:
        raise InvalidImageError("Nenhuma imagem foi enviada.")
    if len(content) > MAX_PHOTO_BYTES:
        raise InvalidImageError("A imagem passa de 5 MB.")

    location = (
        Coordinate(latitude=latitude, longitude=longitude)
        if latitude is not None and longitude is not None
        else None
    )

    return await service.classify(
        device, trip_id, image=content, purpose=purpose, location=location
    )
