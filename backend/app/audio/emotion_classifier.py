"""
Emoção na voz (RF-15, CA-07): Cansado, Neutro, Animado, Tenso ou Bravo.

Usamos o modelo `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`,
que não devolve emoções prontas: ele devolve três números (arousal,
dominância e valência). Motivos da escolha:

- não existe modelo pronto e confiável para as 5 emoções em português;
- esses números dependem mais de como se fala (energia, entonação) do que
  das palavras, então funcionam melhor entre idiomas;
- a conversão para as 5 emoções fica em `emotion_rules.py`, simples de ler
  e de testar sem precisar do `torch`.

O áudio chega do app em WAV (Android) ou CAF (iOS) e é convertido para mono
16 kHz, que é o formato que o modelo espera.

@see https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim
"""

import asyncio
import io
import logging
import threading
from typing import Any, Protocol

from app.audio.emotion_rules import EmotionReading, to_emotion

logger = logging.getLogger("atlas.api")

MODEL_SAMPLE_RATE = 16_000

# Menos que isso não é fala (é um clique ou silêncio).
MIN_SECONDS = 0.4
# Silêncio não tem emoção. Sem esta regra o modelo "inventava" uma emoção.
MIN_LOUDNESS = 0.005
# Corta o áudio em 30 s para um arquivo esquecido não travar a CPU.
MAX_SECONDS = 30


class InvalidAudio(Exception):
    """O arquivo não é um áudio válido ou é curto demais."""


class EmotionUnavailable(Exception):
    """O classificador não está pronto (carregando ou sem dependências)."""


class EmotionClassifier(Protocol):
    @property
    def ready(self) -> bool: ...

    async def classify(self, audio: bytes) -> EmotionReading: ...


class Wav2VecEmotionClassifier:
    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model: Any = None
        self._processor: Any = None
        self._error: str | None = None
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return self._model is not None

    def load_in_background(self) -> None:
        """Carrega o modelo numa thread separada; a API continua respondendo enquanto isso."""
        threading.Thread(target=self._load, name="emotion-loader", daemon=True).start()

    def _load(self) -> None:
        try:
            from transformers import AutoProcessor

            from app.audio.wav2vec_dimensional import DimensionalEmotionModel
        except ImportError:
            self._error = "dependências de áudio ausentes — uv sync --extra audio"
            logger.warning("Emoção na voz desligada: %s", self._error)
            return

        try:
            self._processor = AutoProcessor.from_pretrained(self._model_name)
            self._model = DimensionalEmotionModel.from_pretrained(self._model_name).eval()
            logger.info("Emoção na voz pronta — %s", self._model_name)
        except Exception as error:  # rede, disco, versão: tudo deixa a voz sem emoção
            self._error = str(error)[:200]
            logger.warning("Não foi possível carregar o modelo de emoção: %s", self._error)

    async def classify(self, audio: bytes) -> EmotionReading:
        if not self.ready:
            raise EmotionUnavailable(self._error or "O modelo de emoção está carregando.")
        return await asyncio.to_thread(self._classify, audio)

    def _classify(self, audio: bytes) -> EmotionReading:
        import torch

        samples = decode(audio)

        with self._lock, torch.no_grad():
            inputs = self._processor(samples, sampling_rate=MODEL_SAMPLE_RATE, return_tensors="pt")
            # O modelo devolve nesta ordem: arousal, dominância, valência.
            arousal, dominance, valence = self._model(inputs["input_values"])[0].tolist()

        return to_emotion(arousal=arousal, valence=valence, dominance=dominance)


def decode(audio: bytes):
    """
    Converte os bytes do app para mono 16 kHz, o formato do modelo.

    O `soundfile` lê WAV e CAF sem precisar do `ffmpeg` instalado.
    """
    import numpy as np
    import soundfile

    try:
        samples, rate = soundfile.read(io.BytesIO(audio), dtype="float32", always_2d=True)
    except Exception as error:  # libsndfile levanta tipos próprios
        raise InvalidAudio("O arquivo enviado não é um áudio legível.") from error

    # Mono: a média dos canais.
    mono = samples.mean(axis=1)

    if mono.size < MIN_SECONDS * rate:
        raise InvalidAudio("O áudio é curto demais para dizer alguma coisa.")

    if float(np.sqrt(np.mean(np.square(mono)))) < MIN_LOUDNESS:
        raise InvalidAudio("O áudio está silencioso demais.")

    mono = mono[: int(MAX_SECONDS * rate)]

    if rate != MODEL_SAMPLE_RATE:
        from math import gcd

        from scipy.signal import resample_poly

        divisor = gcd(int(rate), MODEL_SAMPLE_RATE)
        mono = resample_poly(mono, MODEL_SAMPLE_RATE // divisor, int(rate) // divisor)

    return np.asarray(mono, dtype="float32")
