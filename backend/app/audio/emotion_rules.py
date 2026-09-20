"""
De arousal/valência para as 5 emoções do escopo (§4.1).

O modelo não devolve rótulos: devolve **dimensões** — quanta energia há na
fala (arousal), se ela soa positiva ou negativa (valência) e quanto controle
a voz transmite (dominância), cada uma de 0 a 1. A tradução para Cansado,
Neutro, Animado, Tenso e Bravo é a regra abaixo, e ela vive aqui, separada do
modelo, porque é uma decisão do projeto e não do `torch`:

                     valência
                0 ─────────────── 1
     arousal 1  │  BRAVO │ ANIMADO
                │  TENSO │
                │  ─────────────
                │      NEUTRO
             0  │     CANSADO

Sem treino para o português e sem dataset rotulado do grupo, uma régua
explícita é mais honesta que um classificador de caixa-preta: qualquer um lê
estes números e discorda deles com argumento.

**Os limites são uma calibração grossa**, feita em 20/09/2026 com duas falas
reais e com a mesma fala acelerada e amplificada, para ver o arousal subir:
0,18 (voz baixa e lenta) → 0,33 (fala calma) → 0,43 → 0,52 (acelerada e mais
alta). Daí o corte do "cansado" em 0,30 e o da energia alta em 0,60. As faixas
de tenso e bravo não puderam ser medidas: faltava voz irritada gravada. Rodar
`ml/check_emotion.py` com as vozes do grupo é o jeito de ajustar isto com
dados de verdade.

A confiança é a distância até a fronteira mais próxima da regra que decidiu,
normalizada — uma fala bem no meio do quadrante sai com confiança alta, uma
em cima da linha sai com pouca. É esse valor que o `needs_assistance` usa
para oferecer a emergência só quando a tensão é clara (§4.7).
"""

from dataclasses import dataclass

# Abaixo disso a voz é de quem está sem energia.
TIRED_AROUSAL = 0.30
# Acima disso há energia de sobra: animado, tenso ou bravo.
HIGH_AROUSAL = 0.60
# Abaixo disso a fala soa negativa.
NEGATIVE_VALENCE = 0.45
# Bravo é a ponta negativa da valência, não só "não positiva".
ANGRY_VALENCE = 0.35
# Acima disso a fala soa positiva.
POSITIVE_VALENCE = 0.60

# Quanto vale uma margem "cheia": 0,25 na escala de 0 a 1 já é o meio do
# quadrante, e a partir daí a confiança satura em 1.
FULL_MARGIN = 0.25
# Nenhuma leitura sai com confiança zero: ela existe, só é fraca.
MIN_CONFIDENCE = 0.35


@dataclass(frozen=True)
class EmotionReading:
    emotion: str
    confidence: float
    arousal: float
    valence: float
    dominance: float


def to_emotion(arousal: float, valence: float, dominance: float = 0.5) -> EmotionReading:
    """A emoção do escopo para um ponto (arousal, valência)."""
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
        # Neutro é o que sobra, e a margem é a distância até a fronteira mais
        # perto: quem está encostado no "tenso" não é um neutro confiante.
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
