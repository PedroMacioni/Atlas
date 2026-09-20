# Random Forest do Atlas — evidência de teste

Gerado por `ml/train.py` em 20260920101213 (UTC). Modelo: `models/decision_rf.joblib` (3073 KB).

## Dados

- Sintético: **4000** linhas (`data/synthetic.csv`, regras em `RULES.md`).
- Real (testes com o app): **5** linhas (`data/real.csv`).
- Cenários da equipe (fora do treino): **38** linhas.
- Divisão: 80% treino (3204) / 20% teste (801), estratificada.

| Decisão | Linhas | % |
|---|---|---|
| CONTINUAR | 1603 | 40% |
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

- Validação cruzada (5 dobras, F1 macro, treino): **0.877** ± 0.013
- Teste — acurácia: **0.901**
- Teste — F1 macro: **0.889**
- Cenários da equipe: **36/38** acertos

O dataset tem 5% de ruído de rótulo proposital, então o teto realista da acurácia fica perto de 95%.

### Por decisão (teste)

| Decisão | Precisão | Revocação | F1 | Suporte |
|---|---|---|---|---|
| CONTINUAR | 0.93 | 0.92 | 0.93 | 321 |
| DESCANSAR | 0.93 | 0.96 | 0.95 | 113 |
| ABASTECER | 0.88 | 0.91 | 0.89 | 110 |
| ALIMENTAR-SE | 0.83 | 0.95 | 0.88 | 56 |
| REGISTRAR PONTO TURÍSTICO | 0.89 | 0.79 | 0.84 | 42 |
| FAZER UMA PARADA | 0.86 | 0.83 | 0.85 | 159 |

### Matriz de confusão (linhas = real, colunas = previsto)

|  | CONTINUAR | DESCANSAR | ABASTECER | ALIMENTAR-SE | REGISTRAR PONTO TURÍSTICO | FAZER UMA PARADA |
|---|---|---|---|---|---|---|
| CONTINUAR | 295 | 2 | 4 | 5 | 2 | 13 |
| DESCANSAR | 0 | 109 | 0 | 0 | 1 | 3 |
| ABASTECER | 5 | 0 | 100 | 0 | 0 | 5 |
| ALIMENTAR-SE | 1 | 0 | 1 | 53 | 1 | 0 |
| REGISTRAR PONTO TURÍSTICO | 9 | 0 | 0 | 0 | 33 | 0 |
| FAZER UMA PARADA | 6 | 6 | 9 | 6 | 0 | 132 |

### Importância global por variável

| Variável | Importância |
|---|---|
| emocao | 22.8% |
| horario | 21.8% |
| tempo_sem_parada | 17.0% |
| imagem | 15.4% |
| distancia | 14.1% |
| tempo_viagem | 8.9% |

## Cenários da equipe

|  | Cenário | Esperado | Modelo | Confiança |
|---|---|---|---|---|
| ✅ | Exemplo do escopo §4.5: cansado há 2h40 e mais de 2h sem parar | DESCANSAR | DESCANSAR | 94% |
| ✅ | Cansado de manhã depois de 1h40 sem parar | DESCANSAR | DESCANSAR | 79% |
| ✅ | Madrugada com mais de 2h sem parar mesmo sem leitura de voz | DESCANSAR | DESCANSAR | 69% |
| ✅ | Noite e 2h15 sem parar | DESCANSAR | DESCANSAR | 78% |
| ✅ | Cansado vence o posto: segurança antes de abastecer | DESCANSAR | DESCANSAR | 95% |
| ✅ | Cansado vence o almoço | DESCANSAR | DESCANSAR | 94% |
| ✅ | Cansado mas parou há pouco: ainda não é hora de descansar | CONTINUAR | CONTINUAR | 90% |
| ✅ | Madrugada mas só 1h de estrada | CONTINUAR | CONTINUAR | 87% |
| ✅ | Tenso há 1h15 sem parar: pausa curta | FAZER UMA PARADA | FAZER UMA PARADA | 87% |
| ✅ | Irritado no trânsito depois de 1h40 | FAZER UMA PARADA | FAZER UMA PARADA | 58% |
| ✅ | Tensão com viagem longa | FAZER UMA PARADA | FAZER UMA PARADA | 86% |
| ✅ | Tenso mas acabou de sair | CONTINUAR | CONTINUAR | 79% |
| ✅ | 450 km rodados e 1h30 sem parar | ABASTECER | ABASTECER | 85% |
| ✅ | Posto à vista depois de 300 km | ABASTECER | ABASTECER | 39% |
| ❌ | Posto à vista com 270 km mesmo tendo parado há pouco | ABASTECER | CONTINUAR | 42% |
| ✅ | 480 km: autonomia no limite | ABASTECER | ABASTECER | 93% |
| ✅ | Posto à vista mas só 110 km rodados | CONTINUAR | CONTINUAR | 82% |
| ✅ | Almoço e 2h sem parar | ALIMENTAR-SE | ALIMENTAR-SE | 79% |
| ✅ | Jantar e 2h10 sem parar | ALIMENTAR-SE | ALIMENTAR-SE | 78% |
| ✅ | Restaurante à vista no almoço | ALIMENTAR-SE | ALIMENTAR-SE | 59% |
| ✅ | Restaurante à vista no jantar | ALIMENTAR-SE | ALIMENTAR-SE | 66% |
| ❌ | Restaurante fora do horário de refeição | CONTINUAR | ALIMENTAR-SE | 68% |
| ✅ | Almoço mas a viagem acabou de começar | CONTINUAR | CONTINUAR | 85% |
| ✅ | Paisagem com o motorista animado | REGISTRAR PONTO TURÍSTICO | REGISTRAR PONTO TURÍSTICO | 90% |
| ✅ | Ponto turístico com o motorista tranquilo | REGISTRAR PONTO TURÍSTICO | REGISTRAR PONTO TURÍSTICO | 92% |
| ✅ | Ponto turístico sem leitura de voz | REGISTRAR PONTO TURÍSTICO | REGISTRAR PONTO TURÍSTICO | 97% |
| ✅ | Cansado: descansar vence o ponto turístico | DESCANSAR | DESCANSAR | 57% |
| ✅ | Tenso e parou há pouco: não é hora de passeio | CONTINUAR | CONTINUAR | 48% |
| ✅ | 2h40 sem parar em bom estado: pausa genérica | FAZER UMA PARADA | FAZER UMA PARADA | 50% |
| ✅ | Quase 3h sem parar mesmo animado | FAZER UMA PARADA | FAZER UMA PARADA | 79% |
| ✅ | Viagem normal | CONTINUAR | CONTINUAR | 96% |
| ✅ | Início de viagem sem leituras | CONTINUAR | CONTINUAR | 92% |
| ✅ | Animado e parou há 50 min | CONTINUAR | CONTINUAR | 94% |
| ✅ | 1h30 sem parar fora do horário de refeição | CONTINUAR | CONTINUAR | 78% |
| ✅ | Viagem longa mas parou há pouco | CONTINUAR | CONTINUAR | 95% |
| ✅ | Tarde tranquila | CONTINUAR | CONTINUAR | 87% |
| ✅ | Saindo cedo | CONTINUAR | CONTINUAR | 89% |
| ✅ | Noite mas antes das 22h e parou há 1h | CONTINUAR | CONTINUAR | 90% |

## Exemplo do escopo (§4.5), explicado

Entrada: `{'horario': 15.0, 'tempo_viagem_min': 160.0, 'distancia_km': 190.0, 'imagem': 'estrada', 'emocao': 'cansado', 'tempo_sem_parada_min': 130.0}`

> Recomendação: DESCANSAR. Motivo: você parece cansado e está há 2h10 sem parar.

| Variável | Contribuição para a decisão |
|---|---|
| emocao | +0.652 |
| tempo_sem_parada | +0.091 |
| distancia | +0.016 |
| imagem | +0.013 |
| tempo_viagem | +0.011 |
| horario | -0.012 |

Probabilidade de base: 0.167. Base + contribuições = 0.938 (confiança final).
