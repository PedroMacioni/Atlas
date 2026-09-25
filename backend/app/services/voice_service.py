"""
Comando de voz vira evento do diário, junto com a emoção (RF-15, CA-07).

O app já grava o áudio de cada comando para reconhecer a fala. Esse áudio é
enviado para cá, o modelo lê a emoção, e o evento é gravado com `emotion` e
`emotion_confidence`. Essa leitura depois alimenta o Random Forest.

Se o modelo não estiver pronto, o comando é gravado mesmo assim, só que sem
emoção. Perder a frase seria pior que perder a emoção.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from app.audio.emotion_classifier import EmotionClassifier, EmotionUnavailable, InvalidAudio
from app.audio.emotion_rules import EmotionReading
from app.repositories.trip_repository import TripRepository
from app.schemas.coordinate import Coordinate
from app.schemas.trip import Emotion, EventKind
from app.schemas.voice import VoiceCommandResponse
from app.services.trip_service import TripService

logger = logging.getLogger("atlas.api")


class VoiceService:
    def __init__(
        self,
        repository: TripRepository,
        classifier: EmotionClassifier | None,
        *,
        clock=lambda: datetime.now(UTC),
    ) -> None:
        self._repository = repository
        self._trips = TripService(repository)
        self._classifier = classifier
        self._clock = clock

    async def record_command(
        self,
        device: UUID,
        trip_id: UUID,
        *,
        audio: bytes | None,
        transcript: str | None,
        location: Coordinate | None,
    ) -> VoiceCommandResponse:
        _, trip = await self._trips.open_trip(device, trip_id)

        reading, reason = await self._read_emotion(audio)
        now = self._clock()

        event = await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": EventKind.COMMAND.value,
                "occurred_at": now.isoformat(),
                "latitude": location.latitude if location else None,
                "longitude": location.longitude if location else None,
                "command": (transcript or "Comando de voz")[:200],
                "emotion": reading.emotion if reading else None,
                "emotion_confidence": reading.confidence if reading else None,
            }
        )

        return VoiceCommandResponse(
            event_id=event["id"],
            transcript=transcript,
            emotion=Emotion(reading.emotion) if reading else None,
            confidence=reading.confidence if reading else None,
            arousal=reading.arousal if reading else None,
            valence=reading.valence if reading else None,
            dominance=reading.dominance if reading else None,
            reason=reason,
        )

    async def _read_emotion(self, audio: bytes | None) -> tuple[EmotionReading | None, str | None]:
        """Lê a emoção do áudio, ou devolve o motivo de não ter emoção."""
        if not audio:
            return None, "no_audio"

        if self._classifier is None:
            return None, "model_off"

        try:
            return await self._classifier.classify(audio), None
        except InvalidAudio as error:
            # Áudio curto, mudo ou ilegível: o comando vale, a emoção não.
            logger.info("Áudio sem emoção legível: %s", error)
            return None, "invalid_audio"
        except EmotionUnavailable as error:
            logger.warning("Modelo de emoção indisponível: %s", error)
            return None, "model_loading"
