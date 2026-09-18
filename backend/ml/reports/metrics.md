# Random Forest do Atlas — evidência de teste

Gerado por `ml/train.py` em 20260918035322 (UTC). Modelo: `models/decision_rf.joblib` (3091 KB).

## Dados

- Sintético: **4000** linhas (`data/synthetic.csv`, regras em `RULES.md`).
- Real (testes com o app): **0** linhas (`data/real.csv`).
- Cenários da equipe (fora do treino): **38** linhas.
- Divisão: 80% treino (3200) / 20% teste (800), estratificada.

| Decisão | Linhas | % |
|---|---|---|
| CONTINUAR | 1598 | 40% |
| DESCANSAR | 565 | 14% |
| ABASTECER | 549 | 14% |
| ALIMENTAR-SE | 281 | 7% |
| REGISTRAR PONTO TURÍSTICO | 211 | 5% |
| FAZER UMA PARADA | 796 | 20% |

## Hiperparâmetros

```
n_estimators = 200
max_depth = 16
min_samples_leaf = 2
class_weight = balanced
random_state = 42
n_jobs = -1
```

## Resultados

- Validação cruzada (5 dobras, F1 macro, treino): **0.870** ± 0.016
- Teste — acurácia: **0.901**
- Teste — F1 macro: **0.886**
- Cenários da equipe: **36/38** acertos

O dataset tem 5% de ruído de rótulo proposital, então o teto realista da acurácia fica perto de 95%.

### Por decisão (teste)

| Decisão | Precisão | Revocação | F1 | Suporte |
|---|---|---|---|---|
| CONTINUAR | 0.94 | 0.92 | 0.93 | 320 |
| DESCANSAR | 0.93 | 0.96 | 0.95 | 113 |
| ABASTECER | 0.87 | 0.91 | 0.89 | 110 |
| ALIMENTAR-SE | 0.82 | 0.95 | 0.88 | 56 |
| REGISTRAR PONTO TURÍSTICO | 0.87 | 0.79 | 0.82 | 42 |
| FAZER UMA PARADA | 0.87 | 0.83 | 0.85 | 159 |

### Matriz de confusão (linhas = real, colunas = previsto)

|  | CONTINUAR | DESCANSAR | ABASTECER | ALIMENTAR-SE | REGISTRAR PONTO TURÍSTICO | FAZER UMA PARADA |
|---|---|---|---|---|---|---|
| CONTINUAR | 294 | 1 | 5 | 6 | 3 | 11 |
| DESCANSAR | 0 | 109 | 0 | 0 | 1 | 3 |
| ABASTECER | 4 | 0 | 100 | 1 | 0 | 5 |
| ALIMENTAR-SE | 1 | 0 | 1 | 53 | 1 | 0 |
| REGISTRAR PONTO TURÍSTICO | 9 | 0 | 0 | 0 | 33 | 0 |
| FAZER UMA PARADA | 6 | 7 | 9 | 5 | 0 | 132 |

### Importância global por variável

| Variável | Importância |
|---|---|
| emocao | 22.9% |
| horario | 21.9% |
| tempo_sem_parada | 16.8% |
| imagem | 15.3% |
| distancia | 13.8% |
| tempo_viagem | 9.2% |

## Cenários da equipe

|  | Cenário | Esperado | Modelo | Confiança |
|---|---|---|---|---|
| ✅ | Exemplo do escopo §4.5: cansado há 2h40 e mais de 2h sem parar | DESCANSAR | DESCANSAR | 93% |
| ✅ | Cansado de manhã depois de 1h40 sem parar | DESCANSAR | DESCANSAR | 78% |
| ✅ | Madrugada com mais de 2h sem parar mesmo sem leitura de voz | DESCANSAR | DESCANSAR | 76% |
| ✅ | Noite e 2h15 sem parar | DESCANSAR | DESCANSAR | 88% |
| ✅ | Cansado vence o posto: segurança antes de abastecer | DESCANSAR | DESCANSAR | 97% |
| ✅ | Cansado vence o almoço | DESCANSAR | DESCANSAR | 95% |
| ✅ | Cansado mas parou há pouco: ainda não é hora de descansar | CONTINUAR | CONTINUAR | 94% |
| ✅ | Madrugada mas só 1h de estrada | CONTINUAR | CONTINUAR | 92% |
| ✅ | Tenso há 1h15 sem parar: pausa curta | FAZER UMA PARADA | FAZER UMA PARADA | 86% |
| ✅ | Irritado no trânsito depois de 1h40 | FAZER UMA PARADA | FAZER UMA PARADA | 59% |
| ✅ | Tensão com viagem longa | FAZER UMA PARADA | FAZER UMA PARADA | 84% |
| ✅ | Tenso mas acabou de sair | CONTINUAR | CONTINUAR | 84% |
| ✅ | 450 km rodados e 1h30 sem parar | ABASTECER | ABASTECER | 88% |
| ✅ | Posto à vista depois de 300 km | ABASTECER | ABASTECER | 39% |
| ❌ | Posto à vista com 270 km mesmo tendo parado há pouco | ABASTECER | CONTINUAR | 45% |
| ✅ | 480 km: autonomia no limite | ABASTECER | ABASTECER | 91% |
| ✅ | Posto à vista mas só 110 km rodados | CONTINUAR | CONTINUAR | 85% |
| ✅ | Almoço e 2h sem parar | ALIMENTAR-SE | ALIMENTAR-SE | 78% |
| ✅ | Jantar e 2h10 sem parar | ALIMENTAR-SE | ALIMENTAR-SE | 82% |
| ✅ | Restaurante à vista no almoço | ALIMENTAR-SE | ALIMENTAR-SE | 65% |
| ✅ | Restaurante à vista no jantar | ALIMENTAR-SE | ALIMENTAR-SE | 65% |
| ❌ | Restaurante fora do horário de refeição | CONTINUAR | ALIMENTAR-SE | 63% |
| ✅ | Almoço mas a viagem acabou de começar | CONTINUAR | CONTINUAR | 86% |
| ✅ | Paisagem com o motorista animado | REGISTRAR PONTO TURÍSTICO | REGISTRAR PONTO TURÍSTICO | 93% |
| ✅ | Ponto turístico com o motorista tranquilo | REGISTRAR PONTO TURÍSTICO | REGISTRAR PONTO TURÍSTICO | 93% |
| ✅ | Ponto turístico sem leitura de voz | REGISTRAR PONTO TURÍSTICO | REGISTRAR PONTO TURÍSTICO | 98% |
| ✅ | Cansado: descansar vence o ponto turístico | DESCANSAR | DESCANSAR | 59% |
| ✅ | Tenso e parou há pouco: não é hora de passeio | CONTINUAR | CONTINUAR | 42% |
| ✅ | 2h40 sem parar em bom estado: pausa genérica | FAZER UMA PARADA | FAZER UMA PARADA | 56% |
| ✅ | Quase 3h sem parar mesmo animado | FAZER UMA PARADA | FAZER UMA PARADA | 79% |
| ✅ | Viagem normal | CONTINUAR | CONTINUAR | 97% |
| ✅ | Início de viagem sem leituras | CONTINUAR | CONTINUAR | 87% |
| ✅ | Animado e parou há 50 min | CONTINUAR | CONTINUAR | 96% |
| ✅ | 1h30 sem parar fora do horário de refeição | CONTINUAR | CONTINUAR | 78% |
| ✅ | Viagem longa mas parou há pouco | CONTINUAR | CONTINUAR | 90% |
| ✅ | Tarde tranquila | CONTINUAR | CONTINUAR | 88% |
| ✅ | Saindo cedo | CONTINUAR | CONTINUAR | 89% |
| ✅ | Noite mas antes das 22h e parou há 1h | CONTINUAR | CONTINUAR | 93% |

## Exemplo do escopo (§4.5), explicado

Entrada: `{'horario': 15.0, 'tempo_viagem_min': 160.0, 'distancia_km': 190.0, 'imagem': 'estrada', 'emocao': 'cansado', 'tempo_sem_parada_min': 130.0}`

> Recomendação: DESCANSAR. Motivo: você parece cansado e está há 2h10 sem parar.

| Variável | Contribuição para a decisão |
|---|---|
| emocao | +0.655 |
| tempo_sem_parada | +0.076 |
| distancia | +0.012 |
| imagem | +0.011 |
| tempo_viagem | +0.009 |
| horario | -0.000 |

Probabilidade de base: 0.167. Base + contribuições = 0.930 (confiança final).
