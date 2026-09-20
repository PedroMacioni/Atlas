# Atlas — documentação técnica

Copiloto de viagem multimodal. Projeto acadêmico da Faculdade Anhanguera
(Taquaral, Campinas), Prof. Rogério Morandi, escopo v1.0 de 14/09/2026.

Este documento descreve **o que existe e por quê**. Ele está dividido em
blocos independentes para que cada integrante possa assumir um: a Parte 1 é o
aplicativo, a Parte 2 é o backend, a Parte 3 são os modelos de IA, a Parte 4
são os dados, e a Parte 5 amarra tudo nos critérios de aceite.

Documentos irmãos:

- [`demonstracao.md`](demonstracao.md) — roteiro dos 6 cenários ao vivo.
- [`../README.md`](../README.md) — decisões de interface e como rodar.
- [`../backend/README.md`](../backend/README.md) — contrato de cada endpoint.
- [`../backend/ml/README.md`](../backend/ml/README.md) — o Random Forest.

---

## 0. Visão geral

O Atlas é um **sistema de três peças**:

```
┌───────────────────────┐        ┌──────────────────────────┐
│  Aplicativo (celular) │        │  API local (PC da equipe)│
│  Expo / React Native  │◄──────►│  FastAPI / Python        │
│                       │  rede  │                          │
│  GPS, mapa, voz,      │  local │  Random Forest           │
│  câmera, telas        │        │  CLIP (imagem)           │
└───────────────────────┘        │  wav2vec2 (emoção)       │
                                 └────────────┬─────────────┘
                                              │
                          ┌───────────────────┴──────────────────┐
                          │                                      │
                 ┌────────▼────────┐                  ┌──────────▼─────────┐
                 │ Supabase        │                  │ Serviços externos  │
                 │ PostgreSQL      │                  │ TomTom (lugares)   │
                 │ Storage (fotos) │                  │ OSRM (rotas)       │
                 └─────────────────┘                  │ OpenStreetMap      │
                                                      └────────────────────┘
```

**A regra que organiza tudo:** o aplicativo não guarda chave de API nenhuma e
não fala com serviço externo nenhum. Quem faz isso é a API local. Trocar a
TomTom pelo Google, ou o OSRM por outro roteador, é mexer num arquivo do
backend — não é publicar uma versão nova na loja.

| Camada | Tamanho | Testes |
|---|---|---|
| Aplicativo | ~11.900 linhas de TypeScript, 13 features | 47 (Vitest) |
| Backend | ~5.900 linhas de Python | 123 (pytest) |

---

# Parte 1 — O aplicativo

## 1.1 Stack

| Pacote | Papel |
|---|---|
| `expo` ~57 / `react-native` 0.86 | Plataforma |
| `expo-router` | Navegação por arquivos, com abas nativas |
| `react-native-maps` | Mapa, marcadores, traçado da rota |
| `expo-location` | Permissão e leitura do GPS |
| `expo-speech-recognition` | Reconhecimento de fala (módulo nativo) |
| `expo-speech` | Voz do Atlas (TTS) |
| `expo-camera` | Câmera da viagem |
| `expo-image` | Fotos do resumo e do histórico |
| `react-native-reanimated` + `gesture-handler` | Painel arrastável da viagem |
| `@expo/vector-icons` | Ícones, com a mesma cor nas duas plataformas |

**Sem Axios, sem Redux, sem biblioteca de UI.** As chamadas HTTP usam `fetch`
encapsulado em `src/utils/http.ts`, com timeout, cancelamento e erros
classificados. O estado é local a cada tela, em hooks.

**Development build é obrigatório** para voz e câmera: os dois são módulos
nativos e não existem no Expo Go. Lá o app abre, o microfone e a miniatura da
câmera simplesmente não aparecem, e o resto funciona.

## 1.2 Como o código é organizado

```
src/
  app/                 ← telas (expo-router: o arquivo é a rota)
  components/ui/       ← peças visuais sem regra de negócio
  features/            ← uma pasta por capacidade
    <feature>/
      components/      ← o que essa capacidade desenha
      hooks/           ← o estado dela
      services/        ← conversa com a API
      types/           ← o contrato
      utils/           ← funções puras, testáveis
  theme/               ← cores, espaçamento, tipografia, sombras
  utils/               ← http, geo, datas, distância, velocidade
```

As 13 features: `api-status`, `camera`, `destination`, `device`, `emergency`,
`location`, `map`, `nearby`, `recommendation`, `routing`, `trip`,
`trip-session`, `voice`.

**A regra:** uma tela compõe features; ela não sabe como uma rota é calculada
nem como uma foto é classificada. É isso que permitiu trocar o provider de
rotas e a fonte de lugares sem reescrever tela nenhuma.

## 1.3 As telas

| Tela | Arquivo | O que faz |
|---|---|---|
| Início | `app/(tabs)/index.tsx` | Localização, **conexão com a IA**, botão de iniciar, card de voz com a escuta contínua |
| Histórico | `app/(tabs)/history.tsx` | Viagens anteriores do aparelho |
| Sobre | `app/(tabs)/about.tsx` | O que o sistema faz e a arquitetura |
| Definir destino | `app/destination.tsx` | Últimos destinos, filtro de salvos, busca por texto, 5 categorias |
| Viagem | `app/trip.tsx` | Mapa em tela cheia, manobras, painel de chegada, voz, câmera, recomendações |
| Emergência | `app/emergency.tsx` | 3 hospitais próximos, SAMU 192, Polícia 190 |
| Detalhe da viagem | `app/history/[id].tsx` | Resumo final: trajeto, indicadores, fotos, diário de bordo |
| Simulador | `app/simulator.tsx` | Muda as 6 variáveis à mão e mostra a decisão do modelo |

**Nenhuma tela rola**, exceto o histórico e o detalhe. Em movimento, rolagem
disputa com o gesto do mapa e esconde informação.

## 1.4 Definir destino

Três portas para o mesmo lugar:

1. **Últimos destinos** — com o campo vazio, a lista mostra até 10 destinos de
   viagens anteriores, sem repetir lugar, com "Hoje", "Ontem" ou a data. Sai
   do histórico do próprio aparelho (`utils/recent-destinations.ts`).
2. **Filtro Salvos** — troca a lista pelos lugares marcados; com texto, busca
   só entre eles.
3. **Busca por texto** — os salvos primeiro, e atrás deles qualquer lugar ou
   endereço do Brasil pela TomTom, priorizando o que está perto.

As **5 categorias do escopo** (Posto, Restaurante, Hotel, Turismo, Hospital)
buscam por proximidade e mostram 10 opções ordenadas por **tempo de carro** —
não por distância em linha reta, porque o posto do outro lado da rodovia
parece perto até precisar de um retorno.

## 1.5 Viagem em andamento

O mapa ocupa a tela inteira e tudo flutua sobre ele:

- **faixa de manobra** no topo (`features/trip/components/maneuver-banner`);
- **painel de chegada** embaixo, arrastável, com horário previsto, tempo,
  distância e velocímetro;
- **coluna de botões** à direita: microfone, escuta contínua, câmera do mapa,
  avaliação do Random Forest, registrar parada, emergência;
- **miniatura da câmera** no alto, mostrando o que a IA está vendo.

O progresso na rota (`utils/trip-progress.ts`) projeta a posição do GPS sobre
o traçado, calcula o que falta, reconhece a chegada a 40 m e o desvio a 60 m.
É função pura e tem 9 testes.

## 1.6 Voz

Três capacidades distintas, todas em `features/voice`:

| O quê | Onde | Como funciona |
|---|---|---|
| **Comandos** | `utils/command-parser.ts` | Regras em português, não um modelo: previsíveis, testáveis e explicáveis. 14 tipos de comando |
| **Palavra de ativação** | `hooks/use-wake-word.ts` | Sessão contínua que procura "Atlas" no que se fala. Desligada por padrão |
| **Resposta falada** | `services/speech-output.ts` | Voz masculina em pt-BR escolhida pelo identificador do sistema |

O que a vigília ouve **não é gravado nem enviado**. Já o comando é gravado em
arquivo — é dele que sai a emoção (Parte 3.3).

Comandos reconhecidos: ir para categoria, ir para lugar pelo nome, registrar
parada, registrar ponto turístico, adicionar parada, pedir avaliação
("estou cansado", "preciso abastecer ou descansar"), emergência, mal-estar,
encerrar viagem, escolher opção por número ou nome, sim e não.

## 1.7 Câmera

`features/camera` faz duas coisas diferentes com a mesma câmera:

- **leitura automática**, a cada 5 minutos: a foto vira classe e é descartada;
- **registrar ponto turístico**: a foto é guardada e aparece no resumo.

A miniatura é visível de propósito. O `expo-camera` não fotografa com a
pré-visualização escondida, e uma câmera que grava sem aparecer seria
desonesta com quem está no carro.

## 1.8 Testes do aplicativo

47 testes no Vitest (`npm test`), só de funções puras: progresso na rota,
geometria, comandos de voz, palavra de ativação, últimos destinos, filtro de
lugares e as formatações de tela. Componentes ficam de fora — exigiriam o
runtime do React Native, e o retorno seria menor que o custo.

Dois defeitos reais foram encontrados por esses testes: "estou com fome" não
era reconhecido, e um teste provou que a régua de desvio era de 60 m, não 100.

---

# Parte 2 — O backend

## 2.1 Stack e estrutura

FastAPI, Python 3.12, gerenciado com `uv`.

```
backend/app/
  main.py          ← sobe a aplicação e carrega os modelos
  core/            ← configuração, erros, dependências, cliente do Supabase
  routers/         ← HTTP: valida entrada e devolve resposta
  services/        ← regra de negócio
  repositories/    ← acesso ao banco
  providers/       ← serviços externos (TomTom, OSRM, Overpass, Google)
  schemas/         ← contratos de entrada e saída (Pydantic)
  ml/              ← Random Forest: modelo, política, explicação
  vision/          ← CLIP
  audio/           ← emoção na voz
```

**O caminho de toda chamada:** `router → service → repository/provider`. O
router não conhece banco; o service não conhece HTTP; o repository não decide
nada. É o que permite testar tudo com dublês, sem rede e sem banco.

## 2.2 Endpoints

| Método | Rota | Para quê |
|---|---|---|
| `GET` | `/health` | Estado da API, do banco e **dos três modelos** |
| `GET` | `/v1/places` | Busca de destino: catálogo + TomTom |
| `GET` | `/v1/places/{id}` | Um lugar do catálogo |
| `GET` | `/v1/nearby` | As opções próximas por categoria, ordenadas por tempo de carro |
| `POST` | `/v1/routes` | Rota entre dois pontos, com manobras, servida do cache quando possível |
| `POST` | `/v1/trips` | Inicia a viagem |
| `GET` | `/v1/trips` | Histórico do aparelho |
| `GET` | `/v1/trips/{id}` | Detalhe: trajeto, paradas, fotos, diário |
| `POST` | `/v1/trips/{id}/events` | Evento do diário |
| `POST` | `/v1/trips/{id}/stops` | Parada |
| `POST` | `/v1/trips/{id}/finish` | Encerra e calcula o resumo |
| `POST` | `/v1/trips/{id}/scenes` | **Foto** → classe da cena (e a foto guardada, no ponto turístico) |
| `POST` | `/v1/trips/{id}/voice` | **Áudio** → emoção + comando no diário |
| `POST` | `/v1/trips/{id}/recommendations` | Avaliação do Random Forest |
| `POST` | `/v1/trips/{id}/recommendations/{id}/answer` | Aceite ou recusa |

Toda rota de viagem exige o cabeçalho **`X-Atlas-Device`**: o UUID anônimo que
o app gera na primeira execução. É o que substitui o login — uma viagem de
outro aparelho simplesmente não existe.

## 2.3 Erros

Toda falha responde o mesmo envelope, com um código estável que a tela usa
para escolher a mensagem:

```json
{ "error": { "code": "route_not_found", "message": "..." } }
```

| Código | HTTP | Quando |
|---|---|---|
| `invalid_request` | 422 | Entrada inválida |
| `route_not_found` | 404 | Sem trajeto entre os pontos |
| `route_provider_timeout` | 504 | O roteador demorou demais |
| `nearby_unavailable` | 502 | Nenhuma fonte de lugares respondeu |
| `vision_unavailable` | 503 | O CLIP ainda está carregando, ou está desligado |
| `invalid_image` | 422 | Arquivo não é imagem, ou passa de 5 MB |
| `invalid_audio` | 422 | Áudio mudo, curto demais ou acima de 2 MB |
| `trip_not_found` | 404 | Viagem inexistente ou de outro aparelho |
| `trip_already_finished` | 409 | Viagem já encerrada |
| `model_unavailable` | 503 | O Random Forest não foi treinado |
| `database_unavailable` | 503 | Supabase fora |

## 2.4 Degradação: o que acontece quando algo falta

Esta é a característica mais importante do backend para a apresentação — **nada
derruba tudo**:

| O que falta | O que acontece |
|---|---|
| Chave da TomTom | A busca fica só nos lugares salvos; próximos vêm do OpenStreetMap |
| Google Places | As opções vêm da TomTom, sem nota |
| Supabase | Rotas continuam sendo calculadas; some o catálogo e o histórico |
| Random Forest | `model_unavailable`; a viagem funciona sem recomendações |
| CLIP | Câmera inerte; "registrar ponto turístico" grava só o local |
| Modelo de emoção | O comando entra no diário sem emoção |
| API inteira | O app navega com a lista local de lugares e o OSRM direto |

## 2.5 Fontes externas

| Serviço | Para quê | Custo |
|---|---|---|
| **TomTom Search** | Busca por texto e por proximidade | Grátis, sem cartão (2.500/dia) |
| **OSRM público** | Rota e matriz de tempos | Grátis, sem SLA |
| **OpenStreetMap (Overpass)** | Reserva dos lugares próximos | Grátis, sem chave |
| **Google Places** | Opcional, é o único com nota | Exige cartão — **não usado** |

As opções próximas tentam as fontes em ordem e a resposta diz qual respondeu
(`source`) e por que a preferida não (`fallbackReason`).

## 2.6 Testes do backend

123 testes com pytest, sem rede e sem banco: o Supabase é um dublê em memória
e os serviços externos são interceptados. Cobrem o cache de rotas, as manobras,
a cadeia de fontes de lugares, o limite diário, a regra de cena repetida, a
régua de emoção, a política de quando avaliar e as regras do resumo.

---

# Parte 3 — Os três modelos de IA

Todos rodam **no PC da equipe**, carregados em thread na subida da API. Até
ficarem prontos, os endpoints respondem "carregando" em vez de travar.

## 3.1 Random Forest — a decisão (RF-17, CA-08, CA-09)

**6 variáveis de entrada:** horário do dia (em seno e cosseno, para que 23h e
0h fiquem perto), tempo de viagem, distância percorrida, classe da imagem,
emoção da voz e tempo desde a última parada.

**6 decisões possíveis:** CONTINUAR, DESCANSAR, ABASTECER, ALIMENTAR-SE,
REGISTRAR PONTO TURÍSTICO, FAZER UMA PARADA.

| Métrica | Valor |
|---|---|
| Acurácia (teste) | 0,901 |
| F1 macro (teste) | 0,889 |
| Validação cruzada (5 dobras) | 0,877 ± 0,013 |
| Cenários da equipe (fora do treino) | 36/38 |

Hiperparâmetros: 200 árvores, profundidade 16, `class_weight=balanced`.

**A justificativa** não é texto pronto: `ml/explanation.py` pega a
contribuição de cada variável na decisão e monta a frase com as duas ou três
que mais pesaram. É isso que atende o CA-09 e o CA-16.

**Quando avaliar** (`ml/policy.py`) é decisão do backend, não do app:

- a cada 1 hora;
- quando chega uma emoção relevante (cansado, tenso, bravo);
- quando chega uma imagem relevante (posto, restaurante, ponto turístico);
- quando o tempo sem parada cruza 2 horas.

Com 30 minutos de silêncio entre recomendações, para o Atlas não virar
cobrança. Leituras com mais de 30 minutos são consideradas velhas e viram
"desconhecido" — categoria que o modelo aprendeu a tratar.

**Antes do modelo**, uma regra de segurança: tensão forte na voz com confiança
acima de 0,85 oferece a emergência direto, sem passar pela recomendação.

## 3.2 CLIP — a imagem (RF-16, CA-06)

Modelo `openai/clip-vit-base-patch32`, **sem treino**: ele compara a foto com
descrições em texto e diz com qual se parece mais. As 4 classes do escopo são
descritas por várias frases cada, em `vision/scene_classifier.py`.

- ~50 ms por foto, na CPU.
- Medição: **22 acertos em 30** fotos do Wikimedia; boa parte dos erros era
  rótulo ruim da busca (uma foto de "posto" que mostra árvores).
- Abaixo de 0,5 de confiança a leitura é descartada.
- Uma cena repetida não vira evento novo: só quando a classe muda, quando a
  anterior passa de 20 minutos, ou na primeira da viagem.

## 3.3 wav2vec2 dimensional — a emoção (RF-15, CA-07)

Modelo `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`. Ele **não
devolve rótulos**: devolve três dimensões da fala, de 0 a 1 — energia
(arousal), tom positivo ou negativo (valência) e controle (dominância).

Por que dimensional e não um classificador de emoções:

1. não existe modelo pronto e confiável para as 5 emoções do escopo em
   português, e o grupo não tem dataset rotulado para treinar um;
2. dimensões dependem mais de **como** se fala do que das palavras, então
   atravessam melhor a barreira do idioma;
3. a tradução fica visível e discutível, em vez de escondida no modelo.

**A régua** (`audio/emotion_rules.py`):

```
                     valência
                0 ─────────────── 1
     arousal 1  │  BRAVO │ ANIMADO
                │  TENSO │
                │  ─────────────
                │      NEUTRO
             0  │     CANSADO
```

| Corte | Valor |
|---|---|
| Cansado | arousal < 0,30 |
| Energia alta | arousal ≥ 0,60 |
| Valência negativa | < 0,45 |
| Valência de raiva | ≤ 0,35 |
| Valência positiva | ≥ 0,60 |

A confiança é a distância até a fronteira mais próxima: uma fala no meio do
quadrante sai confiante, uma em cima da linha sai fraca.

**A calibração é grossa e isso deve ser dito**: foi feita com duas falas reais
e com a mesma fala acelerada e amplificada (arousal 0,18 → 0,33 → 0,43 →
0,52). As faixas de tenso e bravo não puderam ser medidas por falta de voz
irritada gravada. `ml/check_emotion.py` calibra com as vozes do grupo.

Silêncio é recusado: sem essa guarda, três segundos de silêncio saíam como
"tenso" com arousal 0,60.

---

# Parte 4 — Dados

## 4.1 Banco (Supabase / PostgreSQL)

| Tabela | O que guarda |
|---|---|
| `places` | Catálogo de destinos, com busca insensível a acento |
| `route_cache` | Rotas já calculadas, com validade de 1 hora |
| `devices` | UUID anônimo do aparelho — substitui o login |
| `trips` | Origem, destino, início, fim, distância, duração, emoção predominante |
| `trip_events` | **Diário de bordo**: comando, emoção, imagem, decisão, justificativa, hora e local |
| `stops` | Paradas da viagem, em ordem |
| `photos` | Fotos guardadas, ligadas ao evento que as gerou |
| `recommendations` | O que o modelo viu, respondeu, e se foi aceito |

11 migrações versionadas em `backend/migrations/`, aplicadas em ordem. As
fotos ficam num **bucket privado**: o app recebe URLs assinadas com validade,
nunca o arquivo direto.

## 4.2 Diário de bordo

É a espinha do sistema. Todo evento tem tipo, hora e local, e pode carregar
comando, emoção + confiança, classe de imagem + confiança, decisão e
justificativa. Os tipos: `trip_started`, `trip_ended`, `stop`, `command`,
`recommendation`, `tourist_spot`, `emergency`, `scene`.

O resumo final não é armazenado: é **calculado** a partir do diário —
distância, duração, paradas, maior trecho sem parada e emoção predominante.

## 4.3 Dataset do Random Forest

| Origem | Linhas |
|---|---|
| Sintético, gerado por regras (`ml/generate_dataset.py`) | 4.000 |
| Real, de testes com o app (`ml/export_real_data.py`) | 5 |
| Cenários da equipe, fora do treino | 38 |

O sintético tem **5% de ruído de rótulo proposital**: sem ele o modelo
decoraria as regras e a acurácia seria uma mentira. O teto realista fica perto
de 95%.

Cada recomendação **aceita** num teste real vira uma linha nova. Recusadas não
entram: uma recusa diz "isto não", mas não diz qual era a resposta certa.
Simulações nunca entram.

---

# Parte 5 — Rastreabilidade e limites

## 5.1 Onde cada critério de aceite está implementado

| Critério | Onde |
|---|---|
| CA-01 abertura com localização e IA | `app/(tabs)/index.tsx`, `features/api-status`, `GET /health` |
| CA-02 palavra de ativação e comandos | `features/voice/hooks/use-wake-word.ts`, `utils/command-parser.ts` |
| CA-03 destino por texto, voz e categoria | `app/destination.tsx`, `features/destination` |
| CA-04 3 opções com informações | `backend/app/services/nearby_service.py` (sem nota — ver 5.2) |
| CA-05 mapa com rota e posição | `features/map`, `features/trip` |
| CA-06 4 classes de imagem | `backend/app/vision/scene_classifier.py`, `features/camera` |
| CA-07 5 estados emocionais | `backend/app/audio/`, `features/voice/services/voice-command-service.ts` |
| CA-08 6 variáveis → 6 decisões | `backend/app/ml/` |
| CA-09 justificativa compreensível | `backend/app/ml/explanation.py` |
| CA-10 confirmação antes de mudar a rota | `app/trip.tsx` (`answerRecommendation`) |
| CA-11 diário de bordo | `trip_events`, `features/trip-session` |
| CA-12 fluxo de emergência | `app/emergency.tsx`, `features/emergency` |
| CA-13 3 formas de encerrar | `backend/app/schemas/trip.py` (`EndReason`), `app/trip.tsx` |
| CA-14 resumo com fotos e trajeto | `app/history/[id].tsx`, `TripService.get` |
| CA-15 histórico sem login | `devices` + cabeçalho `X-Atlas-Device` |
| CA-16 explicar a decisão ao vivo | `app/simulator.tsx`, `ml/explanation.py` |

## 5.2 Limites conhecidos

Dizer isto antes de ser perguntado vale mais que ser pego:

1. **Sem nota nos lugares.** Só o Google Places tem avaliação, e a chave exige
   cartão. Decisão de custo; o código aceita a chave sem nenhuma alteração.
2. **Emoção com calibração grossa** — ver 3.3.
3. **Imagem sem treino**: 22/30 na medição, e o CLIP não conhece as
   particularidades de uma estrada brasileira.
4. **Dataset majoritariamente sintético**: 5 linhas reais, todas de CONTINUAR.
5. **OSRM público**: sem SLA, sem trânsito, e proibido para uso comercial.
6. **Navegação curva a curva está fora do escopo** (§15). O que existe —
   manobras, velocímetro, painel arrastável — é extra, sem recálculo de rota.
7. **Tudo depende da rede local** entre o celular e o PC.

## 5.3 Como rodar

```bash
# Backend (uma vez)
cd backend
uv sync --all-extras          # inclui os modelos de imagem e de emoção
cp .env.example .env          # preencher Supabase e TomTom

# Backend (toda vez)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8787

# Aplicativo
npm install
npm start                     # development build, mesma rede do PC
```

Conferir `GET /health` antes de apresentar: `vision` e `voiceEmotion` precisam
estar em `ready`.

```bash
npm run verify                 # typecheck + lint + 47 testes
cd backend && uv run pytest    # 123 testes
```

---

## 6. Sugestão de divisão para a apresentação

Cinco blocos independentes, cada um com o que mostrar ao vivo:

| Bloco | Conteúdo | Demonstra |
|---|---|---|
| **1. Produto e telas** | Partes 0 e 1.3–1.5 | Cenários 1 e 6 |
| **2. Voz** | Partes 1.6 e 3.3 | Cenário 2 |
| **3. IA de decisão** | Parte 3.1 + simulador | Cenário 3 |
| **4. Imagem e câmera** | Partes 1.7 e 3.2 | Cenário 4 |
| **5. Backend e dados** | Partes 2 e 4 | Cenário 5 e o diário |

Quem fechar a apresentação deve assumir a Parte 5.2: os limites conhecidos são
o que separa um protótipo honesto de um que promete demais.
