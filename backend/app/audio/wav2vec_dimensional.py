"""
O modelo dimensional de emoção, na forma que o `transformers` espera.

O repositório do `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim` traz
só os pesos: a cabeça de regressão que transforma a saída do wav2vec2 em três
números não é uma classe do `transformers`, e está publicada no cartão do
modelo. É ela que está aqui, igual à do autor — carregar os pesos sem a
arquitetura certa daria três números sem sentido.

O `import torch` fica dentro do módulo de propósito: quem não instalou o
extra `audio` nem chega a importar este arquivo.

@see https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim
"""

import torch
from torch import nn
from transformers.models.wav2vec2.modeling_wav2vec2 import Wav2Vec2Model, Wav2Vec2PreTrainedModel


class RegressionHead(nn.Module):
    """Duas camadas densas sobre a média temporal do wav2vec2."""

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
        # `post_init` no lugar do `init_weights` do cartão do modelo: é o que
        # o transformers 5 espera de qualquer subclasse.
        self.post_init()

    def forward(self, input_values):
        hidden_states = self.wav2vec2(input_values)[0]
        # Uma fala inteira vira um vetor só: a emoção é da frase, não do quadro.
        pooled = torch.mean(hidden_states, dim=1)
        return self.classifier(pooled)
