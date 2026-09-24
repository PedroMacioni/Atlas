# Roteiro da demonstração ao vivo

Os 6 cenários do escopo (§19), na ordem em que devem ser executados, com o
que verificar em cada um e o que fazer quando algo falhar. O §18 pede um plano
de contingência; ele está no fim, e vale a pena ler **antes** de apresentar.

Cada cenário indica os critérios de aceite que ele demonstra.

---

## Antes de começar (15 minutos antes)

| # | Passo | Como saber que deu certo |
|---|---|---|
| 1 | PC e celular na **mesma rede Wi-Fi** | `ipconfig` no PC; o IP tem que bater com o `EXPO_PUBLIC_ATLAS_API_URL` do `.env` |
| 2 | Subir a API: `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8787` | O log diz `próximos=… busca=… modelo=… câmera=… voz=…` |
| 3 | Esperar os modelos abrirem (~30 s na primeira vez de cada) | `curl localhost:8787/health` responde `"vision":"ready"` e `"voiceEmotion":"ready"` |
| 4 | Abrir o app no celular | A tela inicial mostra **Localização ativa** e **IA conectada — Modelos: decisão, imagem, emoção** |
| 5 | Conferir permissões | Localização, microfone e câmera já concedidas (o iOS pergunta uma vez por instalação) |
| 6 | Bateria e brilho | Celular acima de 50% e brilho alto: a demonstração é na tela |

> **Não rode `--reload`.** Neste Windows o recarregamento automático já deixou
> um processo antigo respondendo na porta com código velho. Suba sem ele e
> reinicie à mão quando mexer no backend.

---

## Viagem de demonstração (o botão do frasco)

Para mostrar — ou fotografar para o slide — a viagem **em andamento** sem
dirigir 116 km:

1. Na tela inicial, tocar no ícone de **frasco** (ao lado da emergência).
2. A viagem abre de **Parque Taquaral, Campinas** até a **São Paulo Expo**,
   com o carro já na **metade do caminho** — o mapa mostra o trecho andado, o
   que falta, a próxima manobra e o horário de chegada.
3. O carro anda sozinho a 100 km/h. O botão de **pause**, sobre o mapa,
   congela a cena na hora da foto.
4. O botão do **frasco**, na mesma coluna, abre as **condições**: as 6
   variáveis do Random Forest, com 1 h de viagem, 1 h sem parada e cansaço na
   voz como ponto de partida.
5. **Pedir recomendação ao Atlas** manda essas condições ao modelo de verdade,
   e a resposta aparece **no mapa**, sobre a viagem.
6. O botão da **bandeira quadriculada** conclui a viagem como se o trajeto
   inteiro tivesse sido dirigido: abre o resumo com o caminho completo
   desenhado no mapa, os 116 km, 1h37 de duração e as paradas que houverem.

> Com 1 h de estrada o modelo responde **CONTINUAR** — é o que ele aprendeu, e
> uma hora não cansa ninguém. Para o **DESCANSAR** do Cenário 3, suba "tempo de
> viagem" e "tempo sem parada" para 2 h ou mais, ou escolha o cenário pronto
> **Cenário 3 do escopo** no alto da folha.

A posição é simulada; todo o resto é real — a rota vem da API de rotas, a
viagem é registrada no diário e a recomendação sai do modelo treinado, marcada
como simulação para nunca entrar no dataset real.

---

## Cenário 1 — Destino manual (CA-01, CA-03, CA-05, CA-15)

1. Abrir o Atlas e mostrar as duas pílulas do topo: localização e IA.
2. Tocar **Iniciar nova viagem**.
3. Mostrar a lista de **Últimos** destinos (vem do histórico do aparelho).
4. Digitar `marechal rondon 700` e escolher o endereço que a TomTom traz.
5. A rota abre e a posição atual aparece no mapa.

**Verificar:** a rota desenhada, o horário de chegada no painel e o
acompanhamento da posição.

---

## Cenário 2 — Busca por voz (CA-02, CA-03, CA-04)

1. Na tela inicial, ligar **Ficar atento** no card de voz.
2. Dizer: **"Atlas, quero ir para o posto mais próximo"**.
3. O Atlas abre Definir destino, busca e **lê as 3 opções em voz alta**.
4. Responder **"o segundo"**.
5. A rota abre no lugar escolhido.

**Verificar:** a escuta contínua reagindo sem toque (CA-02) e a escolha por voz.

> A lista na tela mostra **10 opções**; a voz lê **as 3 primeiras**, que é o que
> o escopo pede. Dez opções faladas não se guardam na cabeça de quem dirige.

---

## Cenário 3 — Recomendação de descanso (CA-08, CA-09, CA-10, CA-16)

Com uma viagem aberta:

1. Toque longo no ícone da lâmpada → abre o **simulador do Random Forest**.
2. Montar o contexto: horário da madrugada, 4 h de viagem, 3 h sem parada,
   emoção **cansado**.
3. Avaliar. O modelo responde **DESCANSAR** com a justificativa e o peso de
   cada variável.
4. Aceitar. O Atlas busca hotéis e postos próximos e **pede confirmação**
   antes de mudar a rota.

**Verificar:** a justificativa em português (CA-09), a confirmação antes do
desvio (CA-10) e a explicação das variáveis — é o CA-16 sendo demonstrado.

---

## Cenário 4 — Ponto turístico (CA-06, CA-11)

1. Na viagem, apontar a câmera do celular para algo reconhecível.
2. Dizer **"Atlas, registrar ponto turístico"** (ou tocar na miniatura da
   câmera, no alto à direita).
3. O aviso confirma: *"Ponto turístico registrado — a IA viu …"*.

**Verificar:** a classe que a IA deu à imagem e o evento no diário de bordo.
A foto aparece no resumo no Cenário 6.

> A miniatura da câmera também lê a estrada sozinha a cada 5 minutos. Isso não
> aparece na tela: vira a variável "imagem" do Random Forest.

---

## Cenário 5 — Emergência (CA-12)

1. Tocar no ícone de alerta (vermelho) na tela da viagem.
2. Mostrar os **3 hospitais mais próximos**, com distância e tempo de carro.
3. Mostrar os botões **SAMU 192** e **Polícia 190**.

**Não toque nos botões de ligação durante a apresentação.** Eles discam de
verdade.

---

## Cenário 6 — Encerramento e histórico (CA-13, CA-14, CA-15)

1. Encerrar a viagem pelo botão **Parar** (ou dizendo "Atlas, encerrar viagem").
2. O resumo abre com: trajeto percorrido, paradas, distância, duração, maior
   trecho sem parada, emoção predominante e **as fotos**.
3. Ir na aba **Histórico** e reabrir a mesma viagem.

**Verificar:** o diário de bordo completo — comandos, emoções lidas da voz,
leituras da câmera, recomendações e a decisão de cada uma.

---

## Se alguma coisa falhar

| Sintoma | O que fazer na hora |
|---|---|
| Tela inicial diz **IA offline** | Conferir o IP no `.env` do app e se o PC e o celular estão na mesma rede. Sem API, o app continua navegando com a lista local de lugares |
| **Busca não traz nada** | Usar um lugar do catálogo ("Faculdade Anhanguera", "Viracopos"): eles respondem mesmo sem TomTom |
| **Microfone não aparece** | O build instalado não é um development build. Demonstrar os mesmos comandos pelos botões da tela |
| **Câmera não aparece** | Permissão negada ou build sem `expo-camera`. "Registrar ponto turístico" continua funcionando, só sem foto |
| `vision_unavailable` **ou** `model_loading` | O modelo ainda está abrindo. Esperar 30 s e repetir — o `/health` diz quando ficou `ready` |
| **A rota não calcula** | O OSRM público caiu. Usar uma viagem já no histórico para mostrar o resumo e o diário |
| **A API parece ignorar uma mudança** | Processo antigo preso na porta: `Get-NetTCPConnection -LocalPort 8787 -State Listen` e encerrar o PID |
| **Nada responde** | Plano B: rodar os cenários 3 e 6 sobre uma viagem já gravada no histórico, que não depende de rede nem de GPS |

---

## O que dizer sobre os limites

Honestidade vale nota, e estas são as fronteiras conhecidas:

- **Sem nota nos lugares.** Só o Google Places tem avaliação, e a chave exige
  cartão. A TomTom cobre a busca e a proximidade, sem nota — decisão de custo,
  registrada no README.
- **Emoção calibrada de forma grossa.** A régua de arousal/valência foi
  ajustada com poucas amostras; `ml/check_emotion.py` é o caminho para
  calibrá-la com as vozes do grupo.
- **Classificação de imagem sem treino.** O CLIP compara a foto com
  descrições em texto. Num teste com 30 imagens acertou 22, e boa parte dos
  erros era rótulo ruim da busca.
- **Dataset majoritariamente sintético.** O `real.csv` tem as recomendações
  aceitas nos testes de verdade; ele cresce a cada teste e entra no
  treinamento automaticamente.
- **Navegação curva a curva está fora do escopo** (§15). O que existe é extra.
