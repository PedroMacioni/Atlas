"""
Gera o dataset sintético (dados de treino) do Random Forest.

    uv run python -m ml.generate_dataset

Saída: `ml/data/synthetic.csv`. A semente é fixa, então rodar de novo gera
exatamente o mesmo arquivo.

Como cada linha é criada:

1. Situação realista: tempo de viagem, velocidade média (para calcular a
   distância), tempo sem parar, horário, emoção e imagem. Na maior parte do
   tempo não há leitura de voz nem de câmera ("desconhecido").
2. Rótulo pelas regras de `labeling.py`, com os limites variando até ±15%
   (como motoristas diferentes).
3. Casos raros: 30% das linhas focam em situações que quase nunca
   apareceriam por acaso (restaurante na hora do almoço, posto na estrada,
   madrugada, tensão...). Assim o modelo também aprende esses casos.
4. Ruído: 5% das linhas recebem uma decisão "vizinha" (ex.: DESCANSAR no
   lugar de FAZER UMA PARADA), porque pessoas não decidem sempre igual.
"""

import csv
import random
from dataclasses import replace
from pathlib import Path

from app.ml.features import TripContext
from ml.labeling import DEFAULT_THRESHOLDS, label

SEED = 42
ROWS = 4_000
LABEL_NOISE = 0.05
FOCUS_SHARE = 0.30

DATA_DIR = Path(__file__).parent / "data"
OUTPUT = DATA_DIR / "synthetic.csv"

COLUMNS = (
    "horario",
    "tempo_viagem_min",
    "distancia_km",
    "imagem",
    "emocao",
    "tempo_sem_parada_min",
    "decisao",
    "origem",
)

EMOTION_WEIGHTS = {
    "desconhecido": 40,
    "neutro": 20,
    "cansado": 12,
    "animado": 12,
    "tenso": 10,
    "bravo": 6,
}

IMAGE_WEIGHTS = {
    "desconhecida": 45,
    "estrada": 30,
    "posto": 9,
    "restaurante": 8,
    "ponto_turistico": 8,
}

# Para qual decisão um rótulo pode "escorregar" no ruído.
NEIGHBORS = {
    "descansar": ("fazer_parada",),
    "fazer_parada": ("descansar", "continuar"),
    "abastecer": ("fazer_parada",),
    "alimentar": ("fazer_parada",),
    "registrar_ponto_turistico": ("continuar",),
    "continuar": ("fazer_parada", "registrar_ponto_turistico"),
}


def _weighted(rng: random.Random, weights: dict[str, int]) -> str:
    return rng.choices(list(weights), weights=list(weights.values()))[0]


def sample_context(rng: random.Random) -> TripContext:
    # Mistura viagens curtas (mais comuns) e longas (onde acontecem as decisões interessantes).
    trip_minutes = rng.uniform(5, 240) if rng.random() < 0.6 else rng.uniform(240, 600)

    average_speed_kmh = rng.uniform(35, 95)
    distance_km = trip_minutes / 60 * average_speed_kmh

    # Um terço das viagens ainda não parou nenhuma vez.
    minutes_since_stop = trip_minutes if rng.random() < 0.35 else rng.uniform(0, trip_minutes)

    # Mais viagens de dia que de madrugada.
    hour = rng.uniform(6, 23) if rng.random() < 0.8 else rng.uniform(0, 24)

    return TripContext(
        hour=hour,
        trip_minutes=trip_minutes,
        distance_km=distance_km,
        image=_weighted(rng, IMAGE_WEIGHTS),
        emotion=_weighted(rng, EMOTION_WEIGHTS),
        minutes_since_stop=minutes_since_stop,
    )


def _meal_hour(rng: random.Random) -> float:
    return rng.uniform(11.5, 14.0) if rng.random() < 0.5 else rng.uniform(18.5, 21.0)


def _night_hour(rng: random.Random) -> float:
    return rng.uniform(22, 24) if rng.random() < 0.4 else rng.uniform(0, 5)


# Cada "foco" transforma uma situação comum numa combinação rara.
FOCUSES = {
    "restaurante_refeicao": lambda c, rng: replace(c, image="restaurante", hour=_meal_hour(rng)),
    "refeicao": lambda c, rng: replace(c, hour=_meal_hour(rng)),
    "posto": lambda c, rng: replace(c, image="posto"),
    "ponto_turistico": lambda c, rng: replace(
        c, image="ponto_turistico", emotion=rng.choice(list(EMOTION_WEIGHTS))
    ),
    "madrugada": lambda c, rng: replace(c, hour=_night_hour(rng)),
    "tensao": lambda c, rng: replace(c, emotion=rng.choice(("tenso", "bravo"))),
    "cansaco": lambda c, rng: replace(c, emotion="cansado"),
}


def generate(rows: int = ROWS, seed: int = SEED) -> list[dict[str, str]]:
    rng = random.Random(seed)
    dataset = []

    for _ in range(rows):
        context = sample_context(rng)

        if rng.random() < FOCUS_SHARE:
            context = rng.choice(list(FOCUSES.values()))(context, rng)

        decision = label(context, DEFAULT_THRESHOLDS.jittered(rng))

        if rng.random() < LABEL_NOISE:
            decision = rng.choice(NEIGHBORS[decision])

        values = context.as_dict()
        dataset.append(
            {
                **{key: str(value) for key, value in values.items()},
                "decisao": decision,
                "origem": "sintetico",
            }
        )

    return dataset


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    dataset = generate()

    with OUTPUT.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(dataset)

    print(f"{len(dataset)} linhas em {OUTPUT}")


if __name__ == "__main__":
    main()
