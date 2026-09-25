"""
Testa a leitura de emoção com gravações do grupo (CA-07, §16).

    uv run python -m ml.check_emotion gravacoes/

Cada áudio da pasta é classificado e o script mostra uma tabela com
arousal, valência, emoção e confiança. Se o nome do arquivo começar pela
emoção esperada (ex.: `bravo_pedro_01.wav`, `cansado_ana.wav`), ele também
conta os acertos.

Serve para ajustar os limites de `app/audio/emotion_rules.py` com dados
reais em vez de palpite.
"""

import sys
from collections import Counter
from pathlib import Path

from app.audio.emotion_classifier import InvalidAudio, Wav2VecEmotionClassifier
from app.audio.emotion_rules import (
    ANGRY_VALENCE,
    HIGH_AROUSAL,
    NEGATIVE_VALENCE,
    POSITIVE_VALENCE,
    TIRED_AROUSAL,
)
from app.core.config import get_settings

AUDIO_SUFFIXES = {".wav", ".caf", ".flac", ".ogg", ".mp3", ".m4a"}


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)

    folder = Path(sys.argv[1])
    files = sorted(f for f in folder.rglob("*") if f.suffix.lower() in AUDIO_SUFFIXES)

    if not files:
        print(f"Nenhum áudio em {folder}.")
        raise SystemExit(1)

    settings = get_settings()
    classifier = Wav2VecEmotionClassifier(settings.voice_emotion_model)
    print(f"Carregando {settings.voice_emotion_model}…")
    classifier._load()  # noqa: SLF001 — script de diagnóstico, sem thread

    if not classifier.ready:
        print("O modelo não carregou. Rode `uv sync --extra audio`.")
        raise SystemExit(1)

    print(
        f"\nCortes atuais: cansado < {TIRED_AROUSAL} de arousal; energia alta >= {HIGH_AROUSAL}; "
        f"valência negativa < {NEGATIVE_VALENCE}, brava <= {ANGRY_VALENCE}, "
        f"positiva >= {POSITIVE_VALENCE}.\n"
    )
    print(f"{'arquivo':38} {'arousal':>8} {'valência':>9} {'emoção':>10} {'conf':>6}  esperado")
    print("-" * 92)

    hits, labelled = 0, 0
    misses: Counter[tuple[str, str]] = Counter()

    for file in files:
        expected = file.stem.split("_")[0].lower()
        try:
            reading = classifier._classify(file.read_bytes())  # noqa: SLF001
        except InvalidAudio as error:
            print(f"{file.name[:38]:38} {'—':>8} {'—':>9} {'—':>10} {'—':>6}  {error}")
            continue

        mark = ""
        if expected in {"cansado", "neutro", "animado", "tenso", "bravo"}:
            labelled += 1
            if reading.emotion == expected:
                hits += 1
                mark = f"  {expected} ✓"
            else:
                misses[(expected, reading.emotion)] += 1
                mark = f"  {expected} ✗"

        print(
            f"{file.name[:38]:38} {reading.arousal:8.2f} {reading.valence:9.2f} "
            f"{reading.emotion:>10} {reading.confidence:6.2f}{mark}"
        )

    if labelled:
        print(f"\nAcertos: {hits}/{labelled}")
        for (expected, got), count in misses.most_common():
            print(f"  {expected} lido como {got}: {count}x")


if __name__ == "__main__":
    main()
