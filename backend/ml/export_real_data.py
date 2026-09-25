"""
Exporta os dados reais dos testes para o dataset (escopo §4.6).

    uv run python -m ml.export_real_data
    uv run python -m ml.train

Cada recomendação que o usuário ACEITOU num teste real vira uma linha do
dataset: as 6 variáveis que o modelo viu e a decisão como rótulo.
Recomendações recusadas não entram (dizem "isto não", mas não dizem qual
seria a certa). Simulações também não entram.

Saída: `ml/data/real.csv`, no mesmo formato do `synthetic.csv`. O `train.py`
junta os dois automaticamente.
"""

import asyncio
import csv

from app.core.config import get_settings
from app.core.database import SupabaseRest
from ml.generate_dataset import COLUMNS, DATA_DIR

OUTPUT = DATA_DIR / "real.csv"


async def fetch_accepted() -> list[dict]:
    database = SupabaseRest(get_settings())
    try:
        return await database.select(
            "recommendations",
            params={
                "select": "decision,features",
                "accepted": "is.true",
                "simulated": "is.false",
                "features": "not.is.null",
                "order": "created_at.asc",
            },
        )
    finally:
        await database.aclose()


def to_row(record: dict) -> dict[str, str] | None:
    features = record.get("features") or {}
    try:
        return {
            "horario": str(features["horario"]),
            "tempo_viagem_min": str(features["tempo_viagem_min"]),
            "distancia_km": str(features["distancia_km"]),
            "imagem": str(features["imagem"]),
            "emocao": str(features["emocao"]),
            "tempo_sem_parada_min": str(features["tempo_sem_parada_min"]),
            "decisao": str(record["decision"]),
            "origem": "real",
        }
    except KeyError:
        return None


def main() -> None:
    records = asyncio.run(fetch_accepted())
    rows = [row for row in map(to_row, records) if row is not None]

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"{len(rows)} recomendações aceitas exportadas para {OUTPUT}")


if __name__ == "__main__":
    main()
