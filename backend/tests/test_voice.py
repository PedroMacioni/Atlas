"""
Emoção na voz (RF-15, CA-07): a régua de arousal/valência e o comando falado
virando evento do diário. Sem modelo e sem rede — o classificador é um dublê.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from app.audio.emotion_classifier import EmotionUnavailable, InvalidAudio
from app.audio.emotion_rules import EmotionReading, to_emotion
from app.schemas.coordinate import Coordinate
from app.services.voice_service import VoiceService
from tests.test_trips import DEVICE, FakeTripRepository

NOW = datetime(2026, 9, 20, 21, 0, tzinfo=UTC)
HERE = Coordinate(latitude=-22.8616, longitude=-47.0452)
AUDIO = b"RIFF....WAVEfmt "


class FakeClassifier:
    def __init__(self, reading: EmotionReading | None = None, raises: Exception | None = None):
        self.reading = reading or to_emotion(arousal=0.5, valence=0.5)
        self.raises = raises

    @property
    def ready(self) -> bool:
        return True

    async def classify(self, audio: bytes) -> EmotionReading:
        if self.raises:
            raise self.raises
        return self.reading


@pytest.fixture
def repository() -> FakeTripRepository:
    return FakeTripRepository()


async def start_trip(repository: FakeTripRepository) -> UUID:
    device_id = await repository.ensure_device(DEVICE)
    trip = await repository.create_trip(
        {
            "device_id": str(device_id),
            "origin_name": "Sua localização",
            "origin_latitude": -22.9,
            "origin_longitude": -47.06,
            "destination_name": "Destino",
            "destination_latitude": -22.86,
            "destination_longitude": -47.04,
            "started_at": (NOW - timedelta(hours=2)).isoformat(),
        }
    )
    return UUID(trip["id"])


def build(repository, classifier) -> VoiceService:
    return VoiceService(repository, classifier, clock=lambda: NOW)


# --- A régua (§4.1) --------------------------------------------------------


@pytest.mark.parametrize(
    ("arousal", "valence", "esperado"),
    [
        (0.15, 0.40, "cansado"),  # voz sem energia
        (0.20, 0.80, "cansado"),  # sem energia vence a valência boa
        (0.75, 0.20, "bravo"),  # muita energia, bem negativa
        (0.70, 0.40, "tenso"),  # muita energia, negativa sem ser raiva
        (0.75, 0.80, "animado"),  # muita energia, positiva
        (0.45, 0.50, "neutro"),  # meio do caminho
        (0.65, 0.50, "neutro"),  # energia alta, mas valência morna
    ],
)
def test_arousal_e_valencia_viram_as_5_emocoes(arousal, valence, esperado):
    assert to_emotion(arousal, valence).emotion == esperado


def test_confianca_cresce_com_a_distancia_da_fronteira():
    encostado = to_emotion(arousal=0.61, valence=0.34)
    no_meio = to_emotion(arousal=0.90, valence=0.05)

    assert encostado.emotion == no_meio.emotion == "bravo"
    assert encostado.confidence < no_meio.confidence
    assert no_meio.confidence == 1.0
    # Nenhuma leitura vale zero: ela existe, só é fraca.
    assert encostado.confidence >= 0.35


def test_valores_fora_da_faixa_sao_aparados():
    reading = to_emotion(arousal=2.0, valence=-1.0)

    assert (reading.arousal, reading.valence) == (1.0, 0.0)
    assert reading.emotion == "bravo"


# --- O comando no diário ---------------------------------------------------


async def test_comando_falado_vira_evento_com_emocao(repository):
    trip_id = await start_trip(repository)
    classifier = FakeClassifier(to_emotion(arousal=0.72, valence=0.25))

    result = await build(repository, classifier).record_command(
        DEVICE, trip_id, audio=AUDIO, transcript="Atlas, preciso parar", location=HERE
    )

    assert result.emotion == "bravo"
    assert result.confidence and result.confidence > 0.5
    assert (result.arousal, result.valence) == (0.72, 0.25)
    assert result.reason is None

    [event] = repository.events
    assert event["kind"] == "command"
    assert event["command"] == "Atlas, preciso parar"
    assert event["emotion"] == "bravo"
    assert event["emotion_confidence"] == result.confidence
    assert (event["latitude"], event["longitude"]) == (HERE.latitude, HERE.longitude)


@pytest.mark.parametrize(
    ("classifier", "audio", "reason"),
    [
        (FakeClassifier(), None, "no_audio"),
        (None, AUDIO, "model_off"),
        (FakeClassifier(raises=InvalidAudio("silêncio")), AUDIO, "invalid_audio"),
        (FakeClassifier(raises=EmotionUnavailable("carregando")), AUDIO, "model_loading"),
    ],
)
async def test_sem_emocao_o_comando_ainda_entra_no_diario(repository, classifier, audio, reason):
    """Perder a frase falada seria pior que perder a emoção dela."""
    trip_id = await start_trip(repository)

    result = await build(repository, classifier).record_command(
        DEVICE, trip_id, audio=audio, transcript="Atlas, registrar parada", location=None
    )

    assert (result.emotion, result.confidence, result.reason) == (None, None, reason)
    [event] = repository.events
    assert event["command"] == "Atlas, registrar parada"
    assert event["emotion"] is None


async def test_comando_sem_transcricao_ainda_e_identificavel(repository):
    trip_id = await start_trip(repository)

    await build(repository, FakeClassifier()).record_command(
        DEVICE, trip_id, audio=AUDIO, transcript=None, location=None
    )

    assert repository.events[0]["command"] == "Comando de voz"
