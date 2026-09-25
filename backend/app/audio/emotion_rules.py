"""
Converte arousal e valência nas 5 emoções do escopo (§4.1).

O modelo devolve três números de 0 a 1:
- arousal: quanta energia tem a fala;
- valência: se a fala soa positiva ou negativa;
- dominância: quanto controle a voz transmite.

A regra abaixo transforma esses números em emoção:

                     valência
                0 ─────────────── 1
     arousal 1  │  BRAVO │ ANIMADO
                │  TENSO │
                │  ─────────────
                │      NEUTRO
             0  │     CANSADO

Uma regra simples é mais transparente que uma "caixa-preta": qualquer um
consegue ler os números e discordar deles.

Os limites foram ajustados com poucas gravações reais (voz baixa e lenta
deu ~0,18 de arousal; fala calma ~0,33; fala acelerada ~0,52). Daí o corte
do "cansado" em 0,30 e da energia alta em 0,60. Para ajustar melhor, rode
`ml/check_emotion.py` com gravações do grupo.

A confiança é a distância até a fronteira mais próxima: bem no meio de uma
região = confiança alta; em cima da linha = confiança baixa. É esse valor
que decide se a tensão é forte o bastante para oferecer a emergência.
"""

from dataclasses import dataclass

# Abaixo disso, voz sem energia (cansado).
TIRED_AROUSAL = 0.30
# Acima disso, muita energia (animado, tenso ou bravo).
HIGH_AROUSAL = 0.60
# Abaixo disso a fala soa negativa.
NEGATIVE_VALENCE = 0.45
# Bravo é o extremo negativo da valência.
ANGRY_VALENCE = 0.35
# Acima disso a fala soa positiva.
POSITIVE_VALENCE = 0.60

# Distância que já conta como confiança total (1,0).
FULL_MARGIN = 0.25
# Confiança mínima de qualquer leitura.
MIN_CONFIDENCE = 0.35


@dataclass(frozen=True)
class EmotionReading:
    emotion: str
    confidence: float
    arousal: float
    valence: float
    dominance: float


def to_emotion(arousal: float, valence: float, dominance: float = 0.5) -> EmotionReading:
    """Emoção do escopo para um ponto (arousal, valência)."""
    arousal = _clamp(arousal)
    valence = _clamp(valence)

    if arousal < TIRED_AROUSAL:
        margin = TIRED_AROUSAL - arousal
        emotion = "cansado"
    elif arousal >= HIGH_AROUSAL and valence <= ANGRY_VALENCE:
        margin = min(arousal - HIGH_AROUSAL, ANGRY_VALENCE - valence)
        emotion = "bravo"
    elif arousal >= HIGH_AROUSAL and valence < NEGATIVE_VALENCE:
        margin = min(arousal - HIGH_AROUSAL, NEGATIVE_VALENCE - valence)
        emotion = "tenso"
    elif arousal >= HIGH_AROUSAL and valence >= POSITIVE_VALENCE:
        margin = min(arousal - HIGH_AROUSAL, valence - POSITIVE_VALENCE)
        emotion = "animado"
    else:
        # Neutro é o que sobra. A margem é a distância até a fronteira mais próxima.
        margin = min(
            arousal - TIRED_AROUSAL,
            max(HIGH_AROUSAL - arousal, NEGATIVE_VALENCE - valence, valence - POSITIVE_VALENCE),
        )
        emotion = "neutro"

    return EmotionReading(
        emotion=emotion,
        confidence=_confidence(margin),
        arousal=round(arousal, 4),
        valence=round(valence, 4),
        dominance=round(_clamp(dominance), 4),
    )


def _confidence(margin: float) -> float:
    filled = min(1.0, max(0.0, margin) / FULL_MARGIN)
    return round(MIN_CONFIDENCE + (1 - MIN_CONFIDENCE) * filled, 4)


def _clamp(value: float) -> float:
    return min(1.0, max(0.0, float(value)))
