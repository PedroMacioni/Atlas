# Random Forest do Atlas

O modelo que recomenda a próxima ação durante a viagem (escopo §4). Recebe as
**6 variáveis** e devolve **1 das 6 decisões**, sempre com uma justificativa em
português.

```bash
cd backend
uv run python -m ml.generate_dataset   # dataset sintético (reprodutível)
uv run python -m ml.export_real_data   # opcional: dados reais dos testes
uv run python -m ml.train              # treina, avalia, grava modelo + relatório
```

A evidência de teste (entregável do escopo) fica em
**[`reports/metrics.md`](reports/metrics.md)**, regenerado a cada treino.

## Dataset (§4.6)

### Origem

Híbrido, como o escopo define:

| Parte | Arquivo | Como nasce | Uso |
|---|---|---|---|
| Sintético | `data/synthetic.csv` | `generate_dataset.py`, rotulado pelas [regras da equipe](RULES.md) | Treino e teste |
| Real | `data/real.csv` | `export_real_data.py`: recomendações **aceitas** pelo usuário nos testes com o app | Treino e teste |
| Cenários da equipe | `data/manual_scenarios.csv` | Escritos à mão, um por situação que a equipe considera óbvia | **Só avaliação**: é a prova final, nunca entra no treino |

### Variáveis (entrada)

| Variável | Unidade | De onde vem na viagem | Codificação |
|---|---|---|---|
| Horário do dia | hora decimal | Relógio, fuso de Brasília | seno + cosseno (23h fica perto de 0h) |
| Tempo de viagem | minutos | `trips.started_at` | número |
| Distância percorrida | km | GPS somado pelo app | número |
| Classe da imagem | estrada, posto, restaurante, ponto_turistico, **desconhecida** | Última foto classificada (≤ 30 min) | one-hot |
| Estado emocional | cansado, neutro, animado, tenso, bravo, **desconhecido** | Última análise de voz (≤ 30 min) | one-hot |
| Tempo desde a última parada | minutos | Último evento `stop` do diário | número |

"Desconhecido" existe porque, na maior parte de uma viagem, não há foto nem
fala recentes, e o modelo precisa saber agir justamente nesse caso. A
codificação vive em `app/ml/features.py` e é a mesma no treino e na API.

### Classes (saída)

CONTINUAR, DESCANSAR, ABASTECER, ALIMENTAR-SE, REGISTRAR PONTO TURÍSTICO e
FAZER UMA PARADA. A distribuição está no relatório.

### Quantidade

4.000 linhas sintéticas, 38 cenários da equipe e as linhas reais que os testes
produzirem.

### Tratamento

1. **Situações plausíveis**: distância derivada do tempo × velocidade média
   (35–95 km/h); tempo sem parada nunca maior que o de viagem; mais viagens de
   dia que de madrugada; peso alto para leituras "desconhecidas".
2. **Limiares individuais**: cada linha usa as regras com ±15% de variação
   (motoristas diferentes).
3. **Cobertura de casos raros**: 30% das linhas saem de um "foco" (restaurante
   em horário de refeição, posto, ponto turístico com cada emoção, madrugada,
   tensão, cansaço). Sorteadas ao acaso, essas combinações quase não
   apareceriam, e o modelo não aprende o que não viu.
4. **Ruído de rótulo**: 5% das linhas trocam para uma decisão vizinha
   plausível. Pessoas não são consistentes, e um modelo treinado com regras
   perfeitas fica frágil na fronteira. É também por isso que a acurácia não
   passa de ~95% por construção.

### Treino e teste

- Divisão 80/20 estratificada, semente fixa (42): tudo é reprodutível.
- `RandomForestClassifier` com `class_weight="balanced"`, porque CONTINUAR é
  ~40% dos dados e, sem o balanceamento, "continuar" quase sempre acertaria.
- **Métrica principal: F1 macro**, que pesa todas as decisões por igual. A
  acurácia sozinha esconderia um modelo ruim nas classes raras.
- Matriz de confusão e métricas por decisão no relatório.

### Escolha dos hiperparâmetros

Validação cruzada de 5 dobras **no conjunto de treino**, F1 macro:

| Profundidade | Folha mín. | 150 árvores | 300 árvores |
|---|---|---|---|
| 10 | 1 | 0,825 | 0,827 |
| 12 | 3 | 0,847 | 0,845 |
| 16 | 1 | 0,875 | 0,876 |
| 16 | 3 | 0,868 | 0,865 |
| sem limite | 1 | 0,875 | 0,878 |

Escolhido: **profundidade 16, folha mínima 2, 200 árvores**. Profundidade 16
ganha de 12 por quase 3 pontos, e sem limite não ganha de 16. Folha 1 tende a
decorar o ruído proposital. Os cenários da equipe **não** foram usados para
escolher nada: ajustar pela prova final seria decorar a resposta.

## A explicação (§4.5, RNF-08)

Cada recomendação diz **por que desta vez**, não "por que em geral". O método é
o de **Saabas** (contribuições por caminho), em `app/ml/model.py`:

> Em cada árvore, a decisão desce da raiz a uma folha. A cada divisão a
> probabilidade de cada decisão muda um pouco, e essa mudança é creditada à
> variável que a divisão testou. Somando todas as árvores:
>
> **probabilidade final = base + Σ contribuições das 6 variáveis**

A soma é exata; há um teste que confere isso contra o `predict_proba`. As
variáveis com maior contribuição viram a frase, com os valores reais:

> Recomendação: DESCANSAR. Motivo: você parece cansado e está há 2h10 sem parar.

Por que não a biblioteca SHAP: dá a mesma leitura por decisão, mas traz
numba/llvmlite (mais de 100 MB) para um serviço que roda no computador da
equipe, e o método de Saabas cabe em uma função que dá para mostrar na
apresentação.

## Quando o modelo roda (RF-18)

A política está em `app/ml/policy.py`, como funções puras testadas:

| Regra | Valor |
|---|---|
| Análise periódica | a cada **60 min** desde a última avaliação |
| Mudança relevante | nova emoção *cansado/tenso/bravo*; nova imagem *posto/restaurante/ponto turístico*; tempo sem parada cruzando **120 min** |
| Leitura válida | voz e câmera valem por **30 min**, depois viram "desconhecidas" |
| Confiança mínima para avisar | **50%** |
| Tempo de espera | a mesma decisão não volta antes de **30 min** |
| CONTINUAR | grava no diário, **não interrompe** o motorista |
| Emergência antes do modelo | *tenso* ou *bravo* com confiança ≥ **85%** oferece a emergência em vez de recomendar (§11) |
| Pedido do usuário | "Atlas, preciso abastecer ou descansar" sempre avalia e sempre responde |

O app só pergunta periodicamente (`trigger: "check"`) e o backend decide se é
hora, porque é ele que tem o diário inteiro.

## Modo de demonstração

`trigger: "simulation"` troca qualquer uma das 6 variáveis e chama o modelo de
verdade. É o que torna o **Cenário 3** do escopo demonstrável em sala: ninguém
vai dirigir 2h40 na apresentação. Simulações são marcadas no diário
("(simulação)"), não contam para o tempo de espera e nunca entram no dataset
real. Desligável com `ATLAS_ML_SIMULATION_ENABLED=false`.

## Limitações conhecidas

- **Combustível**: nenhuma variável mede o tanque; ABASTECER é deduzida. Ver
  [RULES.md](RULES.md#limitação-aceita-combustível).
- **O modelo aprende as regras da equipe.** Com poucos dados reais, o Random
  Forest reproduz, com generalização e tolerância a ruído, o que a equipe
  definiu como certo. Os dados reais, exportados das recomendações aceitas,
  são o que o aproxima do comportamento de motoristas de verdade.
- Emoção e imagem ainda não têm modelo: até a voz e a câmera entrarem, chegam
  como "desconhecidas" ou pelo modo de demonstração.
