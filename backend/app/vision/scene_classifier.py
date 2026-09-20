"""
Classificação de cena (RF-16, CA-06): Estrada, Posto, Restaurante ou Ponto
turístico — sem treinar nada.

O modelo é o CLIP (OpenAI, ViT-B/32), que compara a foto com descrições em
texto e diz com qual ela se parece mais. Cada classe é descrita por várias
frases, e a classe vale pela média delas: "um posto de gasolina" sozinho erra
a foto tirada da fila da bomba, "bombas de combustível" acerta.

Roda na CPU do PC da equipe, em ~0,2 s por foto. O modelo (~600 MB) é baixado
do Hugging Face na primeira subida e fica no cache do usuário; até terminar de
carregar, a API responde `vision_unavailable` em vez de travar a subida.

As dependências (`torch`, `transformers`, `pillow`) são o extra `vision` do
`pyproject.toml`: sem elas a API sobe mesmo assim, e só a câmera fica inerte —
o mesmo acordo do Random Forest ausente.
"""

import asyncio
import io
import logging
import threading
from dataclasses import dataclass
from typing import Any, Protocol

logger = logging.getLogger("atlas.api")

# As frases em inglês: é a língua em que o CLIP foi treinado.
CLASS_PROMPTS: dict[str, tuple[str, ...]] = {
    "estrada": (
        "a photo of a road seen through a car windshield",
        "a photo of a highway with cars",
        "a photo of a city street with traffic",
        "a photo of an empty road",
    ),
    "posto": (
        "a photo of a gas station",
        "a photo of fuel pumps at a petrol station",
        "a photo of a car refueling at a gas station",
    ),
    "restaurante": (
        "a photo of a restaurant",
        "a photo of food on a table",
        "a photo of a cafe or diner",
        "a photo of a plate of food",
    ),
    "ponto_turistico": (
        "a photo of a tourist attraction",
        "a photo of a scenic landscape",
        "a photo of a historic monument or church",
        "a photo of a beach, waterfall or mountain view",
        "a photo of a park with trees and nature",
    ),
}

CLASSES = tuple(CLASS_PROMPTS)


@dataclass(frozen=True)
class SceneReading:
    image_class: str
    confidence: float
    probabilities: dict[str, float]


class InvalidImage(Exception):
    """O arquivo não é uma imagem legível."""


class VisionUnavailable(Exception):
    """O classificador não está pronto — carregando ou sem dependências."""


class SceneClassifier(Protocol):
    @property
    def ready(self) -> bool: ...

    async def classify(self, image: bytes) -> SceneReading: ...


class ClipSceneClassifier:
    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model: Any = None
        self._processor: Any = None
        self._text_features: Any = None
        self._error: str | None = None
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return self._text_features is not None

    def load_in_background(self) -> None:
        """Carrega numa thread: a API responde enquanto o modelo baixa."""
        threading.Thread(target=self._load, name="clip-loader", daemon=True).start()

    def _load(self) -> None:
        try:
            import torch
            from transformers import CLIPModel, CLIPProcessor
        except ImportError:
            self._error = "dependências de visão ausentes — uv sync --extra vision"
            logger.warning("Classificação de imagem desligada: %s", self._error)
            return

        try:
            model = CLIPModel.from_pretrained(self._model_name).eval()
            processor = CLIPProcessor.from_pretrained(self._model_name)

            prompts = [p for phrases in CLASS_PROMPTS.values() for p in phrases]
            with torch.no_grad():
                tokens = processor(text=prompts, return_tensors="pt", padding=True)
                encoded = _embedding(model.get_text_features(**tokens))
                encoded = encoded / encoded.norm(dim=-1, keepdim=True)

            # Uma direção por classe: a média das suas frases, renormalizada.
            per_class, start = [], 0
            for phrases in CLASS_PROMPTS.values():
                mean = encoded[start : start + len(phrases)].mean(dim=0)
                per_class.append(mean / mean.norm())
                start += len(phrases)

            self._model, self._processor = model, processor
            self._text_features = torch.stack(per_class)
            logger.info("Classificação de imagem pronta — %s", self._model_name)
        except Exception as error:  # rede, disco, versão: tudo deixa a câmera inerte
            self._error = str(error)[:200]
            logger.warning("Não foi possível carregar o CLIP: %s", self._error)

    async def classify(self, image: bytes) -> SceneReading:
        if not self.ready:
            raise VisionUnavailable(self._error or "O classificador de imagem está carregando.")
        # Inferência é CPU pura: fora do laço de eventos, uma de cada vez.
        return await asyncio.to_thread(self._classify, image)

    def _classify(self, image: bytes) -> SceneReading:
        import torch
        from PIL import Image, UnidentifiedImageError

        try:
            picture = Image.open(io.BytesIO(image)).convert("RGB")
        except (UnidentifiedImageError, OSError) as error:
            raise InvalidImage("O arquivo enviado não é uma imagem.") from error

        with self._lock, torch.no_grad():
            pixels = self._processor(images=picture, return_tensors="pt")
            features = _embedding(self._model.get_image_features(**pixels))
            features = features / features.norm(dim=-1, keepdim=True)
            logits = self._model.logit_scale.exp() * features @ self._text_features.T
            probabilities = logits.softmax(dim=-1)[0].tolist()

        scores = dict(zip(CLASSES, (round(p, 4) for p in probabilities), strict=True))
        best = max(scores, key=scores.__getitem__)
        return SceneReading(image_class=best, confidence=scores[best], probabilities=scores)


def _embedding(output: Any) -> Any:
    """
    O vetor já projetado no espaço comum de texto e imagem.

    Até o `transformers` 4 as funções `get_*_features` devolviam o tensor; do 5
    em diante devolvem um objeto, com o vetor projetado em `pooler_output`.
    """
    return getattr(output, "pooler_output", output)
