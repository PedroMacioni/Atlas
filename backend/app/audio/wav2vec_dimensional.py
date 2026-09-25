"""
Estrutura do modelo de emoção, no formato que o `transformers` espera.

O repositório do modelo traz só os pesos. A "cabeça" que transforma a saída
do wav2vec2 em três números foi copiada do cartão do modelo. Sem ela, os
números não fariam sentido.

Este arquivo importa `torch`, então só é carregado quando o extra `audio`
está instalado.

@see https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim
"""

import torch
from torch import nn
from transformers.models.wav2vec2.modeling_wav2vec2 import Wav2Vec2Model, Wav2Vec2PreTrainedModel


class RegressionHead(nn.Module):
    """Duas camadas densas sobre a média do wav2vec2 no tempo."""

    def __init__(self, config) -> None:
        super().__init__()
        self.dense = nn.Linear(config.hidden_size, config.hidden_size)
        self.dropout = nn.Dropout(config.final_dropout)
        self.out_proj = nn.Linear(config.hidden_size, config.num_labels)

    def forward(self, features):
        x = self.dropout(features)
        x = self.dense(x)
        x = torch.tanh(x)
        x = self.dropout(x)
        return self.out_proj(x)


class DimensionalEmotionModel(Wav2Vec2PreTrainedModel):
    """Devolve arousal, dominância e valência, nessa ordem, de 0 a 1."""

    def __init__(self, config) -> None:
        super().__init__(config)
        self.config = config
        self.wav2vec2 = Wav2Vec2Model(config)
        self.classifier = RegressionHead(config)
        # `post_init` é o que o transformers 5 espera de qualquer subclasse.
        self.post_init()

    def forward(self, input_values):
        hidden_states = self.wav2vec2(input_values)[0]
        # A fala inteira vira um vetor só (média no tempo).
        pooled = torch.mean(hidden_states, dim=1)
        return self.classifier(pooled)
