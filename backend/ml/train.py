"""
Treina e avalia o Random Forest de recomendação.

    uv run python -m ml.generate_dataset   # se o dataset mudou
    uv run python -m ml.train

Entradas:
- `ml/data/synthetic.csv` — gerado pelas regras da equipe;
- `ml/data/real.csv` — opcional, exportado dos testes reais por
  `ml.export_real_data` (recomendações aceitas pelo usuário);
- `ml/data/manual_scenarios.csv` — os cenários escritos à mão. **Não entram
  no treino**: são a prova final, o conjunto que a equipe considera óbvio.

Saídas:
- `ml/models/decision_rf.joblib` — o modelo que a API carrega;
- `ml/reports/metrics.md` — a evidência de teste (entregável do escopo).
"""

import csv
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

from app.ml.explanation import DECISION_LABELS, explain
from app.ml.features import (
    DECISIONS,
    FEATURE_NAMES,
    FEATURE_TO_VARIABLE,
    VARIABLES,
    TripContext,
    encode,
)
from app.ml.model import DecisionModel

SEED = 42
ML_DIR = Path(__file__).parent
DATA_DIR = ML_DIR / "data"
MODEL_PATH = ML_DIR / "models" / "decision_rf.joblib"
REPORT_PATH = ML_DIR / "reports" / "metrics.md"

# Escolhidos por validação cruzada no treino (F1 macro, 5 dobras), numa grade
# de profundidade {10, 12, 16, sem limite} × folha mínima {1, 3, 5} × árvores
# {150, 300} — ver "Escolha dos hiperparâmetros" em ml/README.md. Nunca pelos
# cenários da equipe: esses são a prova final, e ajustar por eles seria
# decorar a resposta.
HYPERPARAMETERS = {
    "n_estimators": 200,
    # 16 ganhou de 12 por quase 3 pontos de F1; sem limite não ganhou de 16.
    "max_depth": 16,
    # 1 tende a decorar os 5% de ruído proposital do dataset; 2 é o meio-termo.
    "min_samples_leaf": 2,
    # CONTINUAR é mais de 40% do dataset; sem o balanceamento o modelo
    # aprenderia que "continuar" quase sempre acerta.
    "class_weight": "balanced",
    "random_state": SEED,
    "n_jobs": -1,
}


def read_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as file:
        return list(csv.DictReader(file))


def to_context(row: dict[str, str]) -> TripContext:
    return TripContext(
        hour=float(row["horario"]),
        trip_minutes=float(row["tempo_viagem_min"]),
        distance_km=float(row["distancia_km"]),
        image=row["imagem"],
        emotion=row["emocao"],
        minutes_since_stop=float(row["tempo_sem_parada_min"]),
    )


def to_matrix(rows: list[dict[str, str]]) -> tuple[np.ndarray, np.ndarray]:
    X = np.array([encode(to_context(row)) for row in rows], dtype=float)
    y = np.array([row["decisao"] for row in rows])
    return X, y


def markdown_table(header: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(row) + " |" for row in rows]
    return "\n".join(lines)


def main() -> None:
    synthetic = read_rows(DATA_DIR / "synthetic.csv")
    real = read_rows(DATA_DIR / "real.csv")
    manual = read_rows(DATA_DIR / "manual_scenarios.csv")

    if not synthetic:
        raise SystemExit("Dataset ausente — rode antes: uv run python -m ml.generate_dataset")

    X, y = to_matrix(synthetic + real)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )

    forest = RandomForestClassifier(**HYPERPARAMETERS)

    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    cv_scores = cross_val_score(forest, X_train, y_train, cv=folds, scoring="f1_macro")

    forest.fit(X_train, y_train)
    predicted = forest.predict(X_test)

    accuracy = accuracy_score(y_test, predicted)
    macro_f1 = f1_score(y_test, predicted, average="macro")
    report = classification_report(y_test, predicted, labels=list(DECISIONS), output_dict=True)
    matrix = confusion_matrix(y_test, predicted, labels=list(DECISIONS))

    # Importância global, somada por variável do escopo.
    importance = dict.fromkeys(VARIABLES, 0.0)
    for name, value in zip(FEATURE_NAMES, forest.feature_importances_, strict=True):
        importance[FEATURE_TO_VARIABLE[name]] += float(value)

    version = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    bundle = {
        "model": forest,
        "feature_names": FEATURE_NAMES,
        "version": version,
        "hyperparameters": HYPERPARAMETERS,
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, MODEL_PATH, compress=3)

    # A prova final: os cenários da equipe, com o modelo como a API o usa.
    model = DecisionModel(bundle)
    manual_rows = []
    manual_hits = 0
    for row in manual:
        context = to_context(row)
        prediction = model.predict(context)
        hit = prediction.decision == row["decisao"]
        manual_hits += hit
        manual_rows.append(
            [
                "✅" if hit else "❌",
                row["nota"],
                DECISION_LABELS[row["decisao"]],
                DECISION_LABELS[prediction.decision],
                f"{prediction.confidence:.0%}",
            ]
        )

    scope_example = to_context(manual[0]) if manual else None
    scope_prediction = model.predict(scope_example) if scope_example else None

    size_kb = MODEL_PATH.stat().st_size / 1024
    counts = {name: int((y == name).sum()) for name in DECISIONS}

    sections = [
        "# Random Forest do Atlas — evidência de teste",
        "",
        f"Gerado por `ml/train.py` em {version} (UTC). Modelo: "
        f"`models/decision_rf.joblib` ({size_kb:.0f} KB).",
        "",
        "## Dados",
        "",
        f"- Sintético: **{len(synthetic)}** linhas (`data/synthetic.csv`, regras em `RULES.md`).",
        f"- Real (testes com o app): **{len(real)}** linhas (`data/real.csv`).",
        f"- Cenários da equipe (fora do treino): **{len(manual)}** linhas.",
        f"- Divisão: 80% treino ({len(y_train)}) / 20% teste ({len(y_test)}), estratificada.",
        "",
        markdown_table(
            ["Decisão", "Linhas", "%"],
            [
                [DECISION_LABELS[name], str(count), f"{count / len(y):.0%}"]
                for name, count in counts.items()
            ],
        ),
        "",
        "## Hiperparâmetros",
        "",
        "```",
        *(f"{key} = {value}" for key, value in HYPERPARAMETERS.items()),
        "```",
        "",
        "## Resultados",
        "",
        f"- Validação cruzada (5 dobras, F1 macro, treino): **{cv_scores.mean():.3f}** "
        f"± {cv_scores.std():.3f}",
        f"- Teste — acurácia: **{accuracy:.3f}**",
        f"- Teste — F1 macro: **{macro_f1:.3f}**",
        f"- Cenários da equipe: **{manual_hits}/{len(manual)}** acertos",
        "",
        "O dataset tem 5% de ruído de rótulo proposital, então o teto realista da "
        "acurácia fica perto de 95%.",
        "",
        "### Por decisão (teste)",
        "",
        markdown_table(
            ["Decisão", "Precisão", "Revocação", "F1", "Suporte"],
            [
                [
                    DECISION_LABELS[name],
                    f"{report[name]['precision']:.2f}",
                    f"{report[name]['recall']:.2f}",
                    f"{report[name]['f1-score']:.2f}",
                    str(int(report[name]["support"])),
                ]
                for name in DECISIONS
            ],
        ),
        "",
        "### Matriz de confusão (linhas = real, colunas = previsto)",
        "",
        markdown_table(
            ["", *(DECISION_LABELS[name] for name in DECISIONS)],
            [
                [DECISION_LABELS[name], *(str(value) for value in matrix[index])]
                for index, name in enumerate(DECISIONS)
            ],
        ),
        "",
        "### Importância global por variável",
        "",
        markdown_table(
            ["Variável", "Importância"],
            [
                [name, f"{value:.1%}"]
                for name, value in sorted(importance.items(), key=lambda item: -item[1])
            ],
        ),
        "",
        "## Cenários da equipe",
        "",
        markdown_table(["", "Cenário", "Esperado", "Modelo", "Confiança"], manual_rows),
    ]

    if scope_example and scope_prediction:
        scope_text = explain(
            scope_prediction.decision, scope_prediction.contributions, scope_example
        )
        sections += [
            "",
            "## Exemplo do escopo (§4.5), explicado",
            "",
            f"Entrada: `{scope_example.as_dict()}`",
            "",
            f"> {scope_text}",
            "",
            markdown_table(
                ["Variável", "Contribuição para a decisão"],
                [
                    [name, f"{value:+.3f}"]
                    for name, value in sorted(
                        scope_prediction.contributions.items(), key=lambda item: -item[1]
                    )
                ],
            ),
            "",
            f"Probabilidade de base: {scope_prediction.base_probability:.3f}. Base + "
            f"contribuições = {scope_prediction.confidence:.3f} (confiança final).",
        ]

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(sections) + "\n", encoding="utf-8")

    print(f"Modelo: {MODEL_PATH} ({size_kb:.0f} KB)")
    print(f"Acurácia {accuracy:.3f} | F1 macro {macro_f1:.3f} | CV {cv_scores.mean():.3f}")
    print(f"Cenários da equipe: {manual_hits}/{len(manual)}")
    print(f"Relatório: {REPORT_PATH}")


if __name__ == "__main__":
    main()
