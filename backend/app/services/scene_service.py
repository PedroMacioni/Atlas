"""
A câmera no fluxo da viagem (RF-16, RF-22, CA-06).

Dois usos, como o escopo separa:

- **`context`** — a leitura automática. O app fotografa a estrada de tempos em
  tempos, a API classifica e **só a classe fica**. É ela que mantém a variável
  "imagem" do Random Forest viva: uma leitura de posto ou de restaurante ainda
  dispara a próxima avaliação (`ml/policy.evaluation_due`).
- **`tourist_spot`** — "Atlas, registrar ponto turístico". A foto é guardada no
  bucket privado, o evento entra no diário e ela aparece no resumo final e no
  detalhe do histórico.

A leitura automática não vira evento toda vez. Gravar uma cena a cada cinco
minutos encheria o diário de "estrada, estrada, estrada" e não diria nada a
mais ao modelo: só entra quando a classe muda, quando a leitura anterior está
perto de envelhecer, ou quando é a primeira da viagem.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from app.core.errors import InvalidImageError, VisionUnavailableError
from app.repositories.trip_repository import TripRepository
from app.schemas.coordinate import Coordinate
from app.schemas.scene import ScenePurpose, SceneResponse
from app.schemas.trip import EventKind, ImageClass, Photo
from app.services.trip_service import TripService
from app.vision.scene_classifier import InvalidImage, SceneClassifier, VisionUnavailable

logger = logging.getLogger("atlas.api")

# Abaixo disso a câmera não viu nada que valha um evento — o painel do carro,
# o céu, a lateral de um caminhão. O ponto turístico pedido pelo usuário é
# gravado de qualquer jeito: quem mandou registrar foi ele.
MIN_CONTEXT_CONFIDENCE = 0.5

# Uma leitura vale 30 minutos para o modelo (`reading_max_age_minutes`).
# Renovar aos 20 mantém a variável sempre fresca sem gravar a cada foto.
READING_REFRESH_MINUTES = 20


class SceneService:
    def __init__(
        self,
        repository: TripRepository,
        classifier: SceneClassifier | None,
        *,
        photo_url_ttl_seconds: int,
        clock=lambda: datetime.now(UTC),
    ) -> None:
        self._repository = repository
        self._trips = TripService(repository)
        self._classifier = classifier
        self._photo_url_ttl = photo_url_ttl_seconds
        self._clock = clock

    async def classify(
        self,
        device: UUID,
        trip_id: UUID,
        *,
        image: bytes,
        purpose: ScenePurpose,
        location: Coordinate | None,
    ) -> SceneResponse:
        if self._classifier is None:
            raise VisionUnavailableError("A classificação de imagem está desligada nesta API.")

        _, trip = await self._trips.open_trip(device, trip_id)

        try:
            reading = await self._classifier.classify(image)
        except InvalidImage as error:
            raise InvalidImageError(str(error)) from error
        except VisionUnavailable as error:
            raise VisionUnavailableError(str(error)) from error

        image_class = ImageClass(reading.image_class)
        now = self._clock()

        if purpose is ScenePurpose.CONTEXT:
            return await self._record_context(trip, reading, image_class, location, now)

        return await self._record_tourist_spot(trip, reading, image_class, image, location, now)

    async def _record_context(
        self, trip: dict[str, Any], reading, image_class: ImageClass, location, now: datetime
    ) -> SceneResponse:
        if reading.confidence < MIN_CONTEXT_CONFIDENCE:
            return _response(reading, recorded=False, reason="low_confidence")

        events = await self._repository.list_events(UUID(str(trip["id"])))
        if not self._is_news(events, image_class, now):
            return _response(reading, recorded=False, reason="unchanged")

        event = await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": EventKind.SCENE.value,
                "occurred_at": now.isoformat(),
                **_point(location),
                "command": f"Câmera: {_LABELS[image_class]}",
                "image_class": image_class.value,
                "image_confidence": round(reading.confidence, 4),
            }
        )
        return _response(reading, recorded=True, event_id=event["id"])

    def _is_news(
        self, events: list[dict[str, Any]], image_class: ImageClass, now: datetime
    ) -> bool:
        """A leitura muda alguma coisa para o modelo?"""
        previous = [event for event in events if event.get("image_class")]

        if not previous:
            return True

        latest = max(previous, key=lambda event: event["occurred_at"])
        if latest["image_class"] != image_class.value:
            return True

        age = now - _time(latest["occurred_at"])
        return age >= timedelta(minutes=READING_REFRESH_MINUTES)

    async def _record_tourist_spot(
        self,
        trip: dict[str, Any],
        reading,
        image_class: ImageClass,
        image: bytes,
        location,
        now: datetime,
    ) -> SceneResponse:
        event = await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": EventKind.TOURIST_SPOT.value,
                "occurred_at": now.isoformat(),
                **_point(location),
                "command": "Registrar ponto turístico",
                "image_class": image_class.value,
                "image_confidence": round(reading.confidence, 4),
            }
        )

        # A foto depois do evento: sem evento não há a que prender a foto, e
        # uma foto órfã no bucket não aparece em lugar nenhum.
        path = f"{trip['id']}/{uuid4().hex}.jpg"
        await self._repository.upload_photo(path, image)
        row = await self._repository.add_photo({"trip_event_id": event["id"], "storage_path": path})

        signed = await self._repository.sign_photos([path], expires_in=self._photo_url_ttl)
        photo = None

        if url := signed.get(path):
            photo = Photo(
                id=row["id"],
                event_id=event["id"],
                url=url,
                image_class=image_class,
                taken_at=now,
                location=location,
            )
        else:
            logger.warning("Foto guardada mas sem URL assinada: %s", path)

        return _response(reading, recorded=True, event_id=event["id"], photo=photo)


_LABELS = {
    ImageClass.ESTRADA: "estrada",
    ImageClass.POSTO: "posto de combustível",
    ImageClass.RESTAURANTE: "restaurante",
    ImageClass.PONTO_TURISTICO: "ponto turístico",
}


def _response(reading, *, recorded: bool, reason: str | None = None, event_id=None, photo=None):
    return SceneResponse(
        image_class=ImageClass(reading.image_class),
        confidence=reading.confidence,
        probabilities=reading.probabilities,
        recorded=recorded,
        reason=reason,
        event_id=event_id,
        photo=photo,
    )


def _point(location: Coordinate | None) -> dict[str, float | None]:
    return {
        "latitude": location.latitude if location else None,
        "longitude": location.longitude if location else None,
    }


def _time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
