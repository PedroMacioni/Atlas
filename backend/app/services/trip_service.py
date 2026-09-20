"""
Sessão de viagem: início, diário de bordo, paradas, encerramento e histórico.

É o fio do fluxo macro do escopo — Iniciar → … → Registrar → Encerrar. Os
modelos de IA ainda não existem, mas quando existirem escrevem aqui: uma
recomendação é um evento do diário com `decision` e `justification`, uma
emoção detectada é um evento com `emotion`. O resumo já sabe ler esses campos.
"""

import logging
from collections import Counter
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.errors import DatabaseUnavailable, TripAlreadyFinished, TripNotFound
from app.repositories.trip_repository import TripRepository
from app.schemas.coordinate import Coordinate
from app.schemas.trip import (
    Emotion,
    EventCreateRequest,
    EventKind,
    Photo,
    Stop,
    StopCreateRequest,
    TripCard,
    TripCreateRequest,
    TripDetail,
    TripEvent,
    TripFinishRequest,
    TripListResponse,
)

# Quantas viagens o histórico traz. Sem paginação: é um projeto de
# demonstração, e cem viagens já é mais do que o grupo vai fazer.
HISTORY_LIMIT = 100

logger = logging.getLogger("atlas.api")


class TripService:
    def __init__(self, repository: TripRepository, *, photo_url_ttl_seconds: int = 3_600) -> None:
        self._repository = repository
        self._photo_url_ttl = photo_url_ttl_seconds

    async def start(self, device: UUID, payload: TripCreateRequest) -> TripDetail:
        device_id = await self._repository.ensure_device(device)
        now = datetime.now(UTC)

        row = await self._repository.create_trip(
            {
                "device_id": str(device_id),
                "origin_name": payload.origin.name,
                "origin_latitude": payload.origin.latitude,
                "origin_longitude": payload.origin.longitude,
                "destination_name": payload.destination.name,
                "destination_latitude": payload.destination.latitude,
                "destination_longitude": payload.destination.longitude,
                "started_at": now.isoformat(),
            }
        )

        event = await self._repository.add_event(
            {
                "trip_id": row["id"],
                "kind": EventKind.TRIP_STARTED.value,
                "occurred_at": now.isoformat(),
                "latitude": payload.origin.latitude,
                "longitude": payload.origin.longitude,
                "command": f"Destino: {payload.destination.name}",
            }
        )

        return _detail(row, stops=[], events=[event])

    async def record_event(
        self, device: UUID, trip_id: UUID, payload: EventCreateRequest
    ) -> TripEvent:
        _, trip = await self.open_trip(device, trip_id)

        row = await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": payload.kind.value,
                "occurred_at": _iso(payload.occurred_at),
                "latitude": payload.location.latitude if payload.location else None,
                "longitude": payload.location.longitude if payload.location else None,
                "command": payload.command,
                "emotion": _value(payload.emotion),
                "emotion_confidence": payload.emotion_confidence,
                "image_class": _value(payload.image_class),
                "image_confidence": payload.image_confidence,
                "decision": _value(payload.decision),
                "justification": payload.justification,
            }
        )
        return _event(row)

    async def add_stop(self, device: UUID, trip_id: UUID, payload: StopCreateRequest) -> Stop:
        _, trip = await self.open_trip(device, trip_id)
        existing = await self._repository.list_stops(trip["id"])

        row = await self._repository.add_stop(
            {
                "trip_id": trip["id"],
                "name": payload.name,
                "category": payload.category,
                "reason": payload.reason,
                "latitude": payload.location.latitude,
                "longitude": payload.location.longitude,
                "position": len(existing) + 1,
            }
        )

        # A parada também entra no diário: o resumo lê a linha do tempo, e o
        # "maior trecho sem parada" é medido entre eventos.
        await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": EventKind.STOP.value,
                "occurred_at": _iso(payload.occurred_at),
                "latitude": payload.location.latitude,
                "longitude": payload.location.longitude,
                "command": "Registrar parada",
                "justification": payload.reason,
            }
        )
        return _stop(row)

    async def finish(self, device: UUID, trip_id: UUID, payload: TripFinishRequest) -> TripDetail:
        device_id, trip = await self.open_trip(device, trip_id)
        ended_at = payload.ended_at or datetime.now(UTC)
        started_at = _parse_datetime(trip["started_at"])

        events = await self._repository.list_events(trip["id"])
        emotion = predominant_emotion(event.get("emotion") for event in events)

        updated = await self._repository.finish_trip(
            device_id,
            trip["id"],
            {
                "ended_at": ended_at.isoformat(),
                "end_reason": payload.end_reason.value,
                "distance_meters": payload.distance_meters,
                "duration_seconds": max(0.0, (ended_at - started_at).total_seconds()),
                "predominant_emotion": _value(emotion),
                "path": [[point.longitude, point.latitude] for point in payload.path],
            },
        )

        # Outra chamada encerrou a viagem entre a leitura e a escrita.
        if updated is None:
            raise TripAlreadyFinished("Esta viagem já foi encerrada.")

        location = payload.location
        await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": EventKind.TRIP_ENDED.value,
                "occurred_at": ended_at.isoformat(),
                "latitude": location.latitude if location else None,
                "longitude": location.longitude if location else None,
                "command": _END_COMMANDS[payload.end_reason.value],
            }
        )

        return await self.get(device, trip_id)

    async def history(self, device: UUID) -> TripListResponse:
        device_id = await self._repository.ensure_device(device)
        rows = await self._repository.list_trips(device_id, limit=HISTORY_LIMIT)
        cards = [_card(row) for row in rows]
        return TripListResponse(trips=cards, count=len(cards))

    async def get(self, device: UUID, trip_id: UUID) -> TripDetail:
        device_id = await self._repository.ensure_device(device)
        row = await self._repository.get_trip(device_id, trip_id, with_path=True)

        if row is None:
            raise TripNotFound("Viagem não encontrada.")

        stops = await self._repository.list_stops(row["id"])
        events = await self._repository.list_events(row["id"])
        photos = await self._photos(row["id"])
        return _detail(row, stops=stops, events=events, photos=photos)

    async def _photos(self, trip_id: Any) -> list[Photo]:
        """
        As fotos da viagem, com URL temporária (RF-22, CA-14).

        Uma falha aqui não derruba o resumo: sem armazenamento, a viagem
        aparece sem as fotos, e é melhor que uma tela de erro.
        """
        try:
            rows = await self._repository.list_photos(trip_id)
            signed = await self._repository.sign_photos(
                [row["storage_path"] for row in rows], expires_in=self._photo_url_ttl
            )
        except DatabaseUnavailable as error:
            logger.warning("Fotos indisponíveis nesta viagem: %s", error)
            return []

        photos = []
        for row in rows:
            event = row.get("trip_events") or {}
            url = signed.get(row["storage_path"])

            if not url:
                continue

            photos.append(
                Photo(
                    id=row["id"],
                    event_id=event["id"],
                    url=url,
                    image_class=event.get("image_class"),
                    taken_at=event["occurred_at"],
                    location=_coordinate(event.get("latitude"), event.get("longitude")),
                )
            )

        return photos

    async def open_trip(self, device: UUID, trip_id: UUID) -> tuple[UUID, dict[str, Any]]:
        """A viagem, desde que seja do aparelho e ainda esteja em andamento."""
        device_id = await self._repository.ensure_device(device)
        trip = await self._repository.get_trip(device_id, trip_id)

        if trip is None:
            raise TripNotFound("Viagem não encontrada.")

        if trip.get("ended_at"):
            raise TripAlreadyFinished("Esta viagem já foi encerrada.")

        return device_id, trip


_END_COMMANDS = {
    "arrival": "Chegada ao destino confirmada",
    "button": "Viagem encerrada pelo botão",
    "voice": "Atlas, encerrar viagem",
}


# --- Regras do resumo — puras, testadas sem banco --------------------------


def predominant_emotion(emotions: Iterable[str | None]) -> Emotion | None:
    """
    A emoção mais registrada na viagem, ou `None` se nenhuma foi.

    Empate fica com a que apareceu primeiro — `Counter.most_common` preserva a
    ordem de inserção entre iguais, e a primeira leitura é tão boa quanto
    qualquer outra para desempatar.
    """
    valid = [Emotion(value) for value in emotions if value in Emotion._value2member_map_]

    if not valid:
        return None

    return Counter(valid).most_common(1)[0][0]


def longest_stretch_seconds(
    started_at: datetime, ended_at: datetime, stop_times: Iterable[datetime]
) -> float:
    """
    Maior intervalo sem parada, do início ao fim da viagem (§7.2).

    As paradas cortam a viagem em trechos; sem parada nenhuma, o trecho é a
    viagem inteira. Paradas fora do intervalo — relógio do aparelho adiantado,
    por exemplo — são presas às bordas em vez de gerar trecho negativo.
    """
    marks = sorted(min(max(time, started_at), ended_at) for time in stop_times)
    boundaries = [started_at, *marks, ended_at]

    return max(
        (later - earlier).total_seconds()
        for earlier, later in zip(boundaries, boundaries[1:], strict=False)
    )


# --- Montagem das respostas ------------------------------------------------


def _card(row: dict[str, Any]) -> TripCard:
    return TripCard(
        id=row["id"],
        origin_name=row["origin_name"],
        destination_name=row["destination_name"],
        destination=Coordinate(
            latitude=row["destination_latitude"], longitude=row["destination_longitude"]
        ),
        started_at=row["started_at"],
        ended_at=row.get("ended_at"),
        end_reason=row.get("end_reason"),
        distance_meters=row.get("distance_meters"),
        duration_seconds=row.get("duration_seconds"),
        stop_count=_embedded_count(row.get("stops")),
        predominant_emotion=row.get("predominant_emotion"),
    )


def _detail(
    row: dict[str, Any],
    *,
    stops: list[dict],
    events: list[dict],
    photos: list[Photo] | None = None,
) -> TripDetail:
    card = _card({**row, "stops": [{"count": len(stops)}]})
    stretch = None

    if row.get("ended_at"):
        stretch = longest_stretch_seconds(
            _parse_datetime(row["started_at"]),
            _parse_datetime(row["ended_at"]),
            (
                _parse_datetime(event["occurred_at"])
                for event in events
                if event.get("kind") == EventKind.STOP.value
            ),
        )

    return TripDetail(
        **card.model_dump(),
        origin=Coordinate(latitude=row["origin_latitude"], longitude=row["origin_longitude"]),
        path=_path(row.get("path")),
        photos=photos or [],
        stops=[_stop(stop) for stop in stops],
        events=[_event(event) for event in events],
        longest_stretch_without_stop_seconds=stretch,
    )


def _event(row: dict[str, Any]) -> TripEvent:
    return TripEvent(
        id=row["id"],
        kind=row["kind"],
        occurred_at=row["occurred_at"],
        location=_coordinate(row.get("latitude"), row.get("longitude")),
        command=row.get("command"),
        emotion=row.get("emotion"),
        emotion_confidence=row.get("emotion_confidence"),
        image_class=row.get("image_class"),
        image_confidence=row.get("image_confidence"),
        decision=row.get("decision"),
        justification=row.get("justification"),
    )


def _stop(row: dict[str, Any]) -> Stop:
    return Stop(
        id=row["id"],
        position=row["position"],
        name=row["name"],
        category=row.get("category"),
        reason=row.get("reason"),
        location=Coordinate(latitude=row["latitude"], longitude=row["longitude"]),
        created_at=row["created_at"],
    )


def _path(raw: object) -> list[Coordinate]:
    """Trajeto guardado em GeoJSON; um par malformado é descartado, não fatal."""
    if not isinstance(raw, list):
        return []

    return [
        Coordinate(latitude=pair[1], longitude=pair[0])
        for pair in raw
        if isinstance(pair, list | tuple) and len(pair) >= 2
    ]


def _coordinate(latitude: object, longitude: object) -> Coordinate | None:
    if isinstance(latitude, int | float) and isinstance(longitude, int | float):
        return Coordinate(latitude=latitude, longitude=longitude)
    return None


def _embedded_count(raw: object) -> int:
    """Lê o `stops(count)` do PostgREST, que chega como `[{"count": n}]`."""
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        return int(raw[0].get("count") or 0)
    return 0


def _parse_datetime(value: str | datetime) -> datetime:
    return value if isinstance(value, datetime) else datetime.fromisoformat(value)


def _iso(value: datetime | None) -> str:
    return (value or datetime.now(UTC)).isoformat()


def _value(member: Any) -> str | None:
    return member.value if member is not None else None
