"""
Emoção na voz (RF-15, CA-07): Cansado, Neutro, Animado, Tenso ou Bravo.

O modelo é o `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`, treinado
no MSP-Podcast para prever **dimensões** da fala — arousal, dominância e
valência. A escolha é deliberada:

- não existe modelo pronto e confiável para as 5 emoções do escopo em
  português, e o grupo não tem dataset rotulado para treinar um;
- as dimensões dependem mais de **como** se fala (energia, entonação) do que
  das palavras, então atravessam melhor a barreira do idioma;
- a tradução para os 5 estados fica em `emotion_rules.py`, legível e testável
  sem `torch` — a decisão do projeto separada do peso do modelo.

O áudio chega do aplicativo como WAV (Android) ou CAF (iOS), gravado junto do
comando de voz pelo `expo-speech-recognition`. Aqui ele vira mono 16 kHz, que
é o que o modelo espera.

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

# Menos que isso não é fala: é o clique do botão ou um segundo de silêncio.
MIN_SECONDS = 0.4
# Silêncio não é emoção nenhuma. Sem esta guarda o modelo inventa: medido em
# 20/09/2026, três segundos de silêncio saíam como "tenso", arousal 0,60.
MIN_LOUDNESS = 0.005
# O modelo olha a fala inteira de uma vez; 30 s cobrem qualquer comando e
# evitam que um áudio esquecido aberto trave a CPU.
MAX_SECONDS = 30


class InvalidAudio(Exception):
    """O arquivo não é um áudio legível, ou é curto demais para dizer algo."""


class EmotionUnavailable(Exception):
    """O classificador não está pronto — carregando ou sem dependências."""


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
        """Carrega numa thread: a API responde enquanto o modelo baixa."""
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
            # Saída na ordem do modelo: arousal, dominância, valência.
            arousal, dominance, valence = self._model(inputs["input_values"])[0].tolist()

        return to_emotion(arousal=arousal, valence=valence, dominance=dominance)


def decode(audio: bytes):
    """
    Os bytes do aplicativo viram mono 16 kHz, que é o que o modelo espera.

    O Android grava WAV 16 kHz e o iOS grava CAF — o `soundfile` lê os dois
    pela libsndfile, sem depender de `ffmpeg` instalado na máquina.
    """
    import numpy as np
    import soundfile

    try:
        samples, rate = soundfile.read(io.BytesIO(audio), dtype="float32", always_2d=True)
    except Exception as error:  # libsndfile levanta tipos próprios
        raise InvalidAudio("O arquivo enviado não é um áudio legível.") from error

    # Mono: a média dos canais preserva a fala melhor que descartar um lado.
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
