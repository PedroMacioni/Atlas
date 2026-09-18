# Regras de rotulagem — o conhecimento da equipe

Estas regras dão o rótulo de cada linha do dataset sintético. O Random Forest
aprende a partir delas, então **elas definem o comportamento do Atlas**: mudar
uma regra aqui (e em `labeling.py`) e retreinar muda o que o copiloto
recomenda.

São avaliadas **em ordem de prioridade**, com segurança primeiro. A primeira que
casar decide.

| # | Decisão | Quando | Por quê |
|---|---|---|---|
| 1 | **DESCANSAR** | Emoção *cansado* e ≥ 90 min sem parar | Cansaço é o maior risco ao volante; 1h30 já é muito para quem está cansado. |
| 1 | **DESCANSAR** | Noite (22h–5h) e ≥ 120 min sem parar | De madrugada o cansaço aparece mesmo sem a voz denunciar. |
| 2 | **FAZER UMA PARADA** | Emoção *tenso* ou *bravo* e ≥ 60 min sem parar | Tensão e raiva pedem uma pausa curta, não um descanso. |
| 3 | **ABASTECER** | ≥ 400 km percorridos e ≥ 60 min sem parar | Proxy de autonomia (veja *Limitação*). |
| 3 | **ABASTECER** | Imagem *posto* e ≥ 250 km percorridos | Com o posto à vista, vale adiantar. |
| 4 | **ALIMENTAR-SE** | Horário de refeição, imagem *restaurante* e ≥ 60 min sem parar | Restaurante à vista na hora certa. |
| 4 | **ALIMENTAR-SE** | Horário de refeição, ≥ 120 min sem parar e ≥ 90 min de viagem | Hora de comer numa viagem já longa. |
| 5 | **REGISTRAR PONTO TURÍSTICO** | Imagem *ponto turístico* e emoção *animado*, *neutro* ou desconhecida | Só com o motorista em bom estado — tenso ou cansado, não é hora de passeio. |
| 6 | **FAZER UMA PARADA** | ≥ 150 min sem parar | Tempo demais sem parar, qualquer que seja o motivo. |
| — | **CONTINUAR** | Nenhuma das anteriores | |

Horário de refeição: almoço das 11h30 às 14h, jantar das 18h30 às 21h.

## Variabilidade

Cada linha sintética usa estes limiares **deslocados em até ±15%**, sorteados
por linha, como motoristas diferentes que cansam em momentos diferentes. Por
isso o modelo aprende uma faixa em vez de decorar um corte exato, e por isso
casos perto do limiar (270 km com um posto à vista, por exemplo) são
legitimamente ambíguos.

## Limitação aceita: combustível

Nenhuma das 6 variáveis do escopo (§4.3) mede o nível do tanque. **ABASTECER é
deduzida** da distância percorrida (400 km como autonomia típica) e da imagem
de um posto. Consequências conhecidas:

- o Atlas não sabe se o tanque está cheio ou vazio;
- depois de abastecer, a distância percorrida não zera, porque ela é da viagem
  inteira. A regra exige ≥ 60 min sem parar para não recomendar de novo logo
  depois de uma parada, e o tempo de espera de 30 min entre recomendações
  iguais (em `app/ml/policy.py`) completa a proteção.

A limitação foi aceita pela equipe para manter as 6 variáveis exigidas pelo
critério de aceite CA-08.
