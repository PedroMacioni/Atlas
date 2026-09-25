"""
O Random Forest em uso: carregar, decidir e explicar a decisão.

A explicação usa o método de Saabas: em cada árvore, a decisão desce da raiz
até uma folha, e a cada divisão a probabilidade de cada classe muda um
pouco. Essa mudança é creditada à variável testada naquela divisão.
Somando em todas as árvores:

    probabilidade final = probabilidade base + soma das contribuições

A soma bate exatamente com o `predict_proba`, e explica esta decisão em
particular. Foi escolhido no lugar da biblioteca SHAP porque dá o mesmo tipo
de resposta sem dependências pesadas.
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.ml.features import FEATURE_NAMES, FEATURE_TO_VARIABLE, VARIABLES, TripContext, encode

logger = logging.getLogger("atlas.api")


@dataclass(frozen=True)
class Prediction:
    decision: str
    confidence: float
    probabilities: dict[str, float]
    # Quanto cada uma das 6 variáveis contribuiu para a decisão escolhida.
    contributions: dict[str, float]
    base_probability: float


def path_contributions(forest: Any, row: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Método de Saabas para uma linha de entrada.

    Devolve `(base, contribuições)`: `base` tem uma probabilidade por classe e
    `contribuições` tem formato (colunas × classes).
    """
    X = row.reshape(1, -1)
    n_classes = len(forest.classes_)
    base = np.zeros(n_classes)
    contributions = np.zeros((X.shape[1], n_classes))

    for tree_model in forest.estimators_:
        tree = tree_model.tree_
        values = tree.value[:, 0, :]
        probabilities = values / values.sum(axis=1, keepdims=True)

        # No sklearn os nós vão da raiz para as folhas, então a ordem dos índices é o caminho.
        path = tree_model.decision_path(X).indices

        base += probabilities[path[0]]
        for parent, child in zip(path[:-1], path[1:], strict=False):
            contributions[tree.feature[parent]] += probabilities[child] - probabilities[parent]

    n_trees = len(forest.estimators_)
    return base / n_trees, contributions / n_trees


class DecisionModel:
    """O modelo treinado, junto com as informações do treino."""

    def __init__(self, bundle: dict[str, Any]) -> None:
        if tuple(bundle["feature_names"]) != FEATURE_NAMES:
            raise ValueError(
                "O modelo foi treinado com outras variáveis — retreine com ml/train.py."
            )

        self._forest = bundle["model"]
        self.version: str = bundle["version"]
        self.classes: list[str] = [str(name) for name in self._forest.classes_]

    @classmethod
    def load(cls, path: Path) -> "DecisionModel | None":
        """Carrega o modelo do disco, ou `None` se o arquivo não existe ou é inválido."""
        if not path.exists():
            logger.warning("Modelo de recomendação ausente em %s — rode ml/train.py.", path)
            return None

        try:
            return cls(joblib.load(path))
        except Exception:  # noqa: BLE001 — qualquer falha aqui é "sem modelo"
            logger.exception("Modelo de recomendação inválido em %s.", path)
            return None

    def predict(self, context: TripContext) -> Prediction:
        row = np.array(encode(context), dtype=float)
        base, contributions = path_contributions(self._forest, row)
        probabilities = base + contributions.sum(axis=0)

        winner = int(np.argmax(probabilities))

        by_variable = dict.fromkeys(VARIABLES, 0.0)
        for index, feature in enumerate(FEATURE_NAMES):
            by_variable[FEATURE_TO_VARIABLE[feature]] += float(contributions[index, winner])

        return Prediction(
            decision=self.classes[winner],
            confidence=float(probabilities[winner]),
            probabilities={
                name: round(float(value), 4)
                for name, value in zip(self.classes, probabilities, strict=True)
            },
            contributions={name: round(value, 4) for name, value in by_variable.items()},
            base_probability=float(base[winner]),
        )
