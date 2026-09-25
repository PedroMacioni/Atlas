"""
Viagens: início, diário de bordo, paradas, fim e histórico.

Toda rota exige o cabeçalho `X-Atlas-Device` (id anônimo do aparelho).
Não existe DELETE: o histórico é mantido para sempre (RF-30).
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.core.dependencies import DeviceDep, SceneServiceDep, TripServiceDep, VoiceServiceDep
from app.core.errors import InvalidAudioError, InvalidImageError
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
from app.schemas.voice import VoiceCommandResponse

router = APIRouter(prefix="/v1/trips", tags=["viagens"])

_NOT_FOUND = {404: {"description": "Viagem inexistente ou de outro aparelho."}}
_FINISHED = {409: {"description": "A viagem já foi encerrada."}}


@router.post("", response_model=TripDetail, status_code=status.HTTP_201_CREATED)
async def start_trip(
    payload: TripCreateRequest, device: DeviceDep, service: TripServiceDep
) -> TripDetail:
    """Começa uma viagem e grava o primeiro evento do diário."""
    return await service.start(device, payload)


@router.get("", response_model=TripListResponse)
async def list_trips(device: DeviceDep, service: TripServiceDep) -> TripListResponse:
    """Histórico do aparelho, da viagem mais recente para a mais antiga (RF-28)."""
    return await service.history(device)


@router.get("/{trip_id}", response_model=TripDetail, responses=_NOT_FOUND)
async def get_trip(trip_id: UUID, device: DeviceDep, service: TripServiceDep) -> TripDetail:
    """Resumo e detalhe de uma viagem: trajeto, paradas e diário (RF-26, RF-29)."""
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
    """Adiciona um evento ao diário (comando, emergência, recomendação...)."""
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
    """Registra uma parada ("Registrar parada") e o evento no diário."""
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


# Limite de 5 MB por foto (o mesmo do bucket). Uma foto de celular em
# qualidade média tem algumas centenas de kB.
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
    Classifica a foto em Estrada, Posto, Restaurante ou Ponto turístico
    (RF-16, CA-06).

    - `purpose=context`: leitura automática. Só a classe vai para o diário,
      a foto é descartada.
    - `purpose=tourist_spot`: "Registrar ponto turístico". A foto é guardada e
      volta na resposta com um link temporário.

    `recorded=false` quer dizer que a leitura não virou evento (a cena não
    mudou ou a confiança foi baixa demais).
    """
    # `image.size` vem do próprio upload: dá para recusar sem ler o arquivo todo.
    if image.size is not None and image.size > MAX_PHOTO_BYTES:
        raise InvalidImageError("A imagem passa de 5 MB.")

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


# Um comando falado dura segundos: 2 MB cobrem mais de um minuto de áudio.
MAX_AUDIO_BYTES = 2 * 1024 * 1024


@router.post(
    "/{trip_id}/voice", response_model=VoiceCommandResponse, responses=_NOT_FOUND | _FINISHED
)
async def record_voice_command(
    trip_id: UUID,
    device: DeviceDep,
    service: VoiceServiceDep,
    audio: Annotated[UploadFile | None, File(description="O áudio do comando.")] = None,
    transcript: Annotated[str | None, Form(max_length=200)] = None,
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
) -> VoiceCommandResponse:
    """
    Grava o comando de voz no diário, junto com a emoção da voz (RF-15, CA-07).

    O áudio é o mesmo que o reconhecimento de fala já gravou no celular. Sem
    áudio (ou com o modelo ainda carregando), o comando é gravado mesmo assim,
    e `reason` explica por que veio sem emoção.
    """
    if audio is not None and audio.size is not None and audio.size > MAX_AUDIO_BYTES:
        raise InvalidAudioError("O áudio passa de 2 MB.")

    content = await audio.read() if audio else None

    if content is not None and len(content) > MAX_AUDIO_BYTES:
        raise InvalidAudioError("O áudio passa de 2 MB.")

    location = (
        Coordinate(latitude=latitude, longitude=longitude)
        if latitude is not None and longitude is not None
        else None
    )

    return await service.record_command(
        device, trip_id, audio=content, transcript=transcript, location=location
    )
