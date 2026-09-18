"""
As 6 variáveis de entrada do Random Forest (escopo §4.3) e como viram números.

Este arquivo é o contrato entre o treino (`backend/ml/`) e a API: os dois
codificam por aqui, e é isso que garante que o modelo em produção recebe
exatamente o formato com que foi treinado.

| Variável                 | Unidade                 | Codificação                 |
|--------------------------|-------------------------|-----------------------------|
| Horário do dia           | hora decimal, 0–24      | seno e cosseno (cíclico)    |
| Tempo de viagem          | minutos                 | número                      |
| Distância percorrida     | quilômetros             | número                      |
| Classe da imagem         | 4 classes + desconhecida| one-hot                     |
| Estado emocional da voz  | 5 estados + desconhecido| one-hot                     |
| Tempo desde última parada| minutos                 | número                      |

O horário entra como seno e cosseno para que 23h e 0h fiquem perto uma da
outra — como número puro, meia-noite estaria o mais longe possível das 23h.

"Desconhecido" é categoria de primeira classe, e não um buraco: na maior parte
de uma viagem não há foto recente nem fala recente, e o modelo precisa ter
aprendido o que fazer justamente nesse caso.
"""

import math
from dataclasses import dataclass

EMOTIONS = ("cansado", "neutro", "animado", "tenso", "bravo", "desconhecido")
IMAGE_CLASSES = ("estrada", "posto", "restaurante", "ponto_turistico", "desconhecida")

DECISIONS = (
    "continuar",
    "descansar",
    "abastecer",
    "alimentar",
    "registrar_ponto_turistico",
    "fazer_parada",
)

# As 6 variáveis do escopo, na ordem em que a explicação as apresenta.
VARIABLES = (
    "horario",
    "tempo_viagem",
    "distancia",
    "imagem",
    "emocao",
    "tempo_sem_parada",
)

FEATURE_NAMES: tuple[str, ...] = (
    "horario_sin",
    "horario_cos",
    "tempo_viagem_min",
    "distancia_km",
    "tempo_sem_parada_min",
    *(f"imagem_{name}" for name in IMAGE_CLASSES),
    *(f"emocao_{name}" for name in EMOTIONS),
)

# De cada coluna para a variável do escopo que ela representa — é o que
# permite somar as contribuições de `horario_sin` e `horario_cos`, ou das
# colunas one-hot, numa contribuição só por variável.
FEATURE_TO_VARIABLE: dict[str, str] = {
    "horario_sin": "horario",
    "horario_cos": "horario",
    "tempo_viagem_min": "tempo_viagem",
    "distancia_km": "distancia",
    "tempo_sem_parada_min": "tempo_sem_parada",
    **{f"imagem_{name}": "imagem" for name in IMAGE_CLASSES},
    **{f"emocao_{name}": "emocao" for name in EMOTIONS},
}


@dataclass(frozen=True)
class TripContext:
    """Uma leitura das 6 variáveis, em unidades humanas."""

    hour: float
    trip_minutes: float
    distance_km: float
    image: str
    emotion: str
    minutes_since_stop: float

    def __post_init__(self) -> None:
        if self.image not in IMAGE_CLASSES:
            raise ValueError(f"Classe de imagem inválida: {self.image}")
        if self.emotion not in EMOTIONS:
            raise ValueError(f"Emoção inválida: {self.emotion}")

    def as_dict(self) -> dict[str, float | str]:
        return {
            "horario": round(self.hour, 2),
            "tempo_viagem_min": round(self.trip_minutes, 1),
            "distancia_km": round(self.distance_km, 2),
            "imagem": self.image,
            "emocao": self.emotion,
            "tempo_sem_parada_min": round(self.minutes_since_stop, 1),
        }


def encode(context: TripContext) -> list[float]:
    """Vetor na ordem de `FEATURE_NAMES`."""
    angle = 2 * math.pi * (context.hour % 24) / 24

    return [
        math.sin(angle),
        math.cos(angle),
        float(context.trip_minutes),
        float(context.distance_km),
        float(context.minutes_since_stop),
        *(1.0 if context.image == name else 0.0 for name in IMAGE_CLASSES),
        *(1.0 if context.emotion == name else 0.0 for name in EMOTIONS),
    ]
