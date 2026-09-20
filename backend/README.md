# Atlas API

Backend do Atlas — **FastAPI + Supabase**. É a "API local em Python" do
escopo: roda no computador da equipe, na mesma rede do celular, e é onde os
modelos de IA vão morar. Quatro responsabilidades nesta fase:

1. **Guardar as chaves.** Nenhuma credencial precisa existir dentro do
   aplicativo. Uma variável `EXPO_PUBLIC_` é inlinada no bundle e fica legível
   em texto puro; uma chave de serviço no servidor não.
2. **Absorver o provider externo.** O app pede uma rota à API, e a API decide
   se responde do cache ou se chama o OSRM. Trocar de provider de rotas deixa
   de ser um release na loja.
3. **Servir o catálogo de lugares.** Os lugares de demonstração saem do
   bundle e viram dado, com busca e filtro resolvidos no banco.
4. **Registrar as viagens.** Início, diário de bordo, paradas, encerramento e
   histórico, associados a um identificador anônimo do aparelho — **sem
   login**, como o escopo define (§8).

Voz, emoção, classificação de imagem e o Random Forest de recomendação são as
fases seguintes. O diário já tem os campos que eles vão preencher.

---

## Endpoints

| Método | Rota | Papel |
|---|---|---|
| `GET` | `/health` | Diagnóstico: versão, ambiente, provider ativo e estado do banco. |
| `GET` | `/v1/places` | Lista lugares. Busca por texto e filtro por categoria. |
| `GET` | `/v1/places/{id}` | Um lugar pelo identificador. |
| `POST` | `/v1/routes` | Calcula a rota entre dois pontos, com paradas opcionais (`waypoints`). |
| `GET` | `/v1/nearby` | As 3 opções mais próximas **de carro**, com distância, tempo e nota. |
| `POST` | `/v1/trips` | Abre uma viagem e registra o início no diário. |
| `GET` | `/v1/trips` | Histórico do aparelho, mais recente primeiro. |
| `GET` | `/v1/trips/{id}` | Resumo/detalhe: trajeto, paradas, diário e indicadores. |
| `POST` | `/v1/trips/{id}/events` | Evento no diário: comando, emergência, recomendação. |
| `POST` | `/v1/trips/{id}/stops` | "Registrar parada". |
| `POST` | `/v1/trips/{id}/finish` | Encerra (`arrival`, `button` ou `voice`) e devolve o resumo. |
| `POST` | `/v1/trips/{id}/recommendations` | Random Forest: avalia (`check`, `manual` ou `simulation`) e recomenda, com justificativa. |
| `POST` | `/v1/trips/{id}/recommendations/{rid}/answer` | Aceita ou recusa a recomendação (CA-10). |

Documentação interativa em `/docs` (Swagger) e `/redoc` com o servidor de pé.

### `POST /v1/routes`

Pedido:

```json
{
  "origin":      { "latitude": -22.9099, "longitude": -47.0626 },
  "destination": { "latitude": -23.0074, "longitude": -47.1345 }
}
```

Resposta:

```json
{
  "coordinates": [{ "latitude": -22.909918, "longitude": -47.062606 }],
  "distanceMeters": 17854.8,
  "durationSeconds": 1327.3,
  "steps": [
    {
      "type": "turn",
      "modifier": "right",
      "roadName": "Rua Barreto Leme",
      "distanceAlongRouteMeters": 408.0,
      "location": { "latitude": -22.902322, "longitude": -47.062644 }
    }
  ],
  "provider": "osrm-public-demo",
  "cached": false
}
```

#### As manobras

`steps` traz as manobras em ordem, e a API entrega **dados, não frases**: tipo,
modificador, nome da via e posição. Quem escreve "Vire à direita na Rua Barreto
Leme" é o aplicativo, porque isso é texto de interface — depende do idioma, do
espaço na tela e de a via ter nome.

`distanceAlongRouteMeters` é a distância **desde a partida** até a manobra, e
não o tamanho do passo como o OSRM devolve. A conversão acontece aqui para que
o aplicativo saiba o que falta até a próxima curva por subtração, sem refazer
geometria.

O vocabulário é normalizado: `"end of road"` vira `end-of-road`, `"sharp
left"` vira `sharp-left`, e um tipo que o provider inventar vira `continue` —
seguir em frente é a única instrução que nunca manda o motorista para o lugar
errado.

Manobras nunca derrubam uma rota. Provider sem instruções, formato inesperado
ou linha de cache corrompida devolvem `[]`, e a tela mostra o trajeto sem a
faixa — que é exatamente o comportamento anterior a elas.

Os três primeiros campos são exatamente o `RouteResult` que a interface do
Atlas já consome — o app não traduz nada. `provider` e `cached` são aditivos e
contam a procedência: `cached: true` significa que nenhuma chamada externa foi
feita para atender o pedido.

É `POST`, e não `GET`, porque o par de coordenadas pertence ao corpo e porque
nenhum intermediário deve decidir a validade de uma rota — quem decide é esta
API, pelo `route_cache`, com o TTL que ela controla.

### `GET /v1/places`

| Parâmetro | Papel |
|---|---|
| `query` | Termo de busca. Insensível a acento e a caixa: `sao paulo` encontra `São Paulo`. |
| `category` | `fuel`, `food`, `parking` ou `saved`. |
| `limit` | 1 a 100. Padrão 20. Vale para a soma de salvos e TomTom. |
| `latitude`, `longitude` | Onde o usuário está. Opcionais; com eles, a TomTom prefere o que é perto. |

Duas fontes, nesta ordem:

1. **Catálogo** (banco): os lugares salvos, sempre primeiro.
2. **TomTom Search**, só quando há texto com 3 letras ou mais e nenhuma
   `category`: qualquer estabelecimento ou endereço do Brasil, com
   autocomplete (`typeahead`). Resultados a menos de 150 m de um salvo são o
   mesmo lugar e não se repetem. Sem chave, com o limite do dia esgotado ou
   com a TomTom fora, a resposta sai só com o catálogo.

Os achados da TomTom têm `id` com prefixo `tomtom:`, `saved: false` e
`category` deduzida do tipo do lugar — `fuel`, `food`, `parking` ou `other`
(shopping, faculdade, um endereço). Não passam por `GET /v1/places/{id}`: o
aplicativo abre a viagem direto pelas coordenadas.

Resposta:

```json
{
  "places": [
    {
      "id": "viracopos",
      "name": "Aeroporto de Viracopos",
      "address": "Campinas, SP",
      "category": "saved",
      "saved": true,
      "latitude": -23.0074,
      "longitude": -47.1345
    }
  ],
  "count": 1
}
```

Os nomes dos campos são idênticos ao tipo `Place` do aplicativo.

`saved` não é uma categoria como as outras: é a marcação do usuário. Filtrar
por `saved` devolve o que está marcado, e um posto salvo continua aparecendo em
`fuel` — a mesma regra de `filter-places.ts`.

A ordem é `saved desc, priority desc, name asc`. A coluna `priority` existe
porque o alfabeto não expressa importância: sem ela o destino de todo dia
ficaria abaixo de um aeroporto só porque "Aeroporto" vem antes de
"Anhanguera". Maior vem primeiro, empate cai no alfabeto, e o padrão `0`
mantém a ordem de quem não a usa. `priority` não entra na resposta da API — a
ordem é responsabilidade do servidor, não da tela.

### Viagens e diário de bordo

Toda rota de `/v1/trips` exige o cabeçalho **`X-Atlas-Device`**: o UUID v4
que o aplicativo gera na primeira execução e guarda no aparelho. O backend
registra o aparelho em `devices` na primeira chamada, e toda leitura filtra por
ele — uma viagem de outro aparelho responde `trip_not_found`.

Não existe `DELETE`. O histórico é mantido por tempo indeterminado e não há
exclusão pelo aplicativo (RF-30).

O encerramento recebe a distância **percorrida** (somada pelo app sobre o GPS)
e o trajeto percorrido; a duração, a emoção predominante e o "maior trecho sem
parada" são calculados aqui. As regras do resumo são funções puras em
`services/trip_service.py`, testadas sem banco.

Emoção, classe de imagem e decisão são vocabulários fechados — os do escopo,
em `schemas/trip.py` e nos `CHECK` do banco:

| Campo | Valores |
|---|---|
| `emotion` | `cansado`, `neutro`, `animado`, `tenso`, `bravo` |
| `imageClass` | `estrada`, `posto`, `restaurante`, `ponto_turistico` |
| `kind` | `trip_started`, `trip_ended`, `stop`, `command`, `recommendation`, `tourist_spot`, `emergency`, `scene` |
| `decision` | `continuar`, `descansar`, `abastecer`, `alimentar`, `registrar_ponto_turistico`, `fazer_parada` |

### Opções próximas (`GET /v1/nearby`)

`category` é uma das 5 categorias do escopo — `posto`, `restaurante`, `hotel`,
`ponto_turistico`, `hospital` — ou uma das duas das recomendações: `descanso`
(posto ou hotel) e `parada` (local de pausa).

1. **Google Places** (API New), se houver chave e ainda houver limite no dia
   — é a única fonte com nota, mas exige cartão;
2. **TomTom**, se houver chave e limite: grátis, rápida, sem nota;
3. **OpenStreetMap** (Overpass), se nenhuma das anteriores respondeu.
   `source` (`google-places`, `tomtom`, `openstreetmap`) e `fallbackReason`
   dizem qual respondeu e por que a preferida não;
4. **tempo de carro** pelo OSRM (`table`) para os candidatos, numa chamada;
5. as **3 mais rápidas de alcançar**. As fontes ordenam em linha reta, e o posto
   do outro lado da rodovia parece perto até precisar de um retorno.

Nada é guardado: os termos do Google proíbem cachear o conteúdo do Places
(nome, nota, endereço). O custo é controlado pelo limite diário e pela cota do
console. A TomTom tem um limite só, somando a busca de destino e os próximos.

> **O OpenStreetMap é reserva, não fonte de demonstração.** O servidor público
> do Overpass é compartilhado pelo mundo todo: medido em 18/09/2026, levou
> 23 s para responder, e às vezes responde 429. A demo depende da TomTom (ou
> do Google) configurada.
>
> **Nota (RF-08).** Só o Google tem. Com TomTom ou OpenStreetMap, `rating` e
> `ratingCount` vêm `null` e a tela diz de onde vieram os lugares.

### Configurar a TomTom

Grátis e sem cartão. O plano Freemium dá **2.500 consultas por dia**, somando
busca de destino e próximos.

1. Crie a conta em [developer.tomtom.com](https://developer.tomtom.com) e
   confirme o e-mail.
2. No painel, em **Keys**, copie a chave criada (ou crie uma, marcando a
   **Search API**).
3. No `backend/.env`:

   ```
   ATLAS_TOMTOM_API_KEY=a-chave-criada
   ```

4. Reinicie a API. O log de subida deve dizer `próximos=tomtom+osm
   busca=catálogo+tomtom`. Teste:

   ```bash
   curl "http://localhost:8787/v1/places?query=posto%20shell&latitude=-22.87&longitude=-47.05"
   ```

   Os postos de Campinas com `id` começando por `tomtom:` confirmam.

A chave da TomTom vai na URL — é o único jeito que ela aceita. Por isso o log
do `httpx` fica desligado abaixo de `WARNING` e nenhuma mensagem de erro repete
a URL chamada.

> **Termos de uso.** Os termos da TomTom restringem exibir o conteúdo dela
> sobre mapas de outros fornecedores (o app usa Apple/Google Maps). Para
> desenvolvimento e avaliação acadêmica não há problema; antes de publicar,
> revise os termos do plano.

### Configurar o Google Places

A nota (`rating`) só vem no plano **Enterprise** da busca próxima, que tem
**1.000 consultas grátis por mês**. Sem a nota seriam 5.000, mas o escopo
exige a nota. Para ensaios e apresentação, 1.000 sobra — desde que haja
limite.

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um
   projeto (ex.: `atlas`).
2. **Faturamento** → vincule uma conta de faturamento. O Google exige cartão
   mesmo para ficar na cota gratuita. Em *Orçamentos e alertas*, crie um
   orçamento de R$ 1 com alerta por e-mail: se algo sair do previsto, vocês
   sabem no mesmo dia.
3. **APIs e serviços → Biblioteca** → ative **"Places API (New)"**. Não a
   "Places API" antiga: o endpoint é outro e esta API não fala com ela.
4. **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
   Em *Restrições de API*, marque só a **Places API (New)**. Uma chave que só
   abre o Places não serve para nada caro se vazar.
5. **APIs e serviços → Places API (New) → Cotas** → limite as requisições de
   *Nearby Search* por dia a **30**. É a barreira que vale mesmo se a API do
   Atlas for reiniciada e o contador interno zerar.
6. No `backend/.env`:

   ```
   ATLAS_GOOGLE_PLACES_API_KEY=a-chave-criada
   ```

7. Reinicie a API. O log de subida deve dizer `próximos=google+…`. Teste:

   ```bash
   curl "http://localhost:8787/v1/nearby?category=posto&latitude=-22.8616&longitude=-47.0452"
   ```

   `"source": "google-places"` e as notas preenchidas confirmam. Se vier
   `tomtom` ou `openstreetmap` com `fallbackReason: "Google Places indisponível"`, o log da
   API mostra a resposta do Google — quase sempre a API não ativada (passo 3)
   ou a restrição da chave (passo 4).

### Câmera (`POST /v1/trips/{id}/scenes`)

A foto sobe como `multipart/form-data` no campo `image` (JPEG, até 5 MB), com
`purpose` no corpo e a posição na query:

| `purpose` | O que acontece | Guarda a foto? |
|---|---|---|
| `context` (padrão) | Leitura automática da câmera. Vira um evento `scene` com a classe e a confiança. | Não |
| `tourist_spot` | "Registrar ponto turístico": evento `tourist_spot`, foto no bucket privado e URL assinada na resposta. | Sim |

A resposta traz `imageClass`, `confidence`, as 4 `probabilities` e `recorded`.
`recorded: false` com `reason` diz por que a leitura não virou evento:

- `unchanged` — a cena é a mesma da leitura anterior e ela ainda é recente
  (menos de 20 min). O diário não ganha "estrada, estrada, estrada", e o
  modelo já tem essa leitura;
- `low_confidence` — abaixo de 0,5 a câmera pegou o painel, o céu ou a
  traseira de um caminhão. O ponto turístico pedido pelo usuário é gravado de
  qualquer jeito: quem mandou registrar foi ele.

Uma leitura que **muda** a cena para posto, restaurante ou ponto turístico
dispara a próxima avaliação do Random Forest (`ml/policy.evaluation_due`) — é
por isso que a câmera existe no fluxo, e não só no álbum.

As fotos guardadas voltam em `photos` no detalhe da viagem (`GET
/v1/trips/{id}`), em ordem cronológica e com URL temporária — o resumo final
e o histórico as mostram (CA-14).

### Configurar a câmera

O classificador é o **CLIP** (`openai/clip-vit-base-patch32`), que compara a
foto com descrições em texto: não há treino, e as 4 classes do escopo são
frases em `app/vision/scene_classifier.py`. Medido em 20/09/2026 num Ryzen 7
5700X3D, leva ~50 ms por foto na CPU.

```bash
uv sync --extra vision
```

O modelo (~600 MB) é baixado do Hugging Face na primeira subida e fica no
cache do usuário. O carregamento acontece **numa thread**: a API sobe na hora
e, até o modelo ficar pronto, a câmera responde `vision_unavailable`. Sem o
extra instalado ou com `ATLAS_VISION_ENABLED=false`, a câmera fica inerte e o
resto da viagem funciona igual.

O bucket `photos` é privado e só a chave de serviço o alcança; o aplicativo
recebe URLs assinadas, válidas por `ATLAS_PHOTO_URL_TTL_SECONDS`.

### Emoção na voz (`POST /v1/trips/{id}/voice`)

O comando falado entra no diário com a emoção junto (RF-15, CA-07). O áudio
sobe em `multipart/form-data` no campo `audio` (WAV no Android, CAF no iOS,
até 2 MB), com `transcript` no corpo e a posição na query.

A resposta traz `emotion` (uma das 5 do escopo), `confidence` e as três
dimensões cruas — `arousal`, `valence`, `dominance`. Sem emoção legível o
comando **é gravado assim mesmo**, e `reason` explica: `no_audio`,
`model_off`, `model_loading` ou `invalid_audio`. Perder a frase falada seria
pior que perder a emoção dela.

A partir daí tudo que já existia funciona sozinho: a leitura alimenta a
variável "emoção" do Random Forest, uma emoção relevante antecipa a próxima
avaliação, e tensão forte e confiante faz o Atlas oferecer a emergência (§4.7).

### Configurar a emoção na voz

O modelo é o `audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim`, treinado
no MSP-Podcast. Ele **não devolve rótulos**: devolve energia (arousal), tom
positivo ou negativo (valência) e controle (dominância), de 0 a 1. A tradução
para Cansado, Neutro, Animado, Tenso e Bravo é uma régua explícita em
`app/audio/emotion_rules.py` — legível, testável sem `torch`, e discutível com
argumento na apresentação.

```bash
uv sync --extra audio
```

A calibração atual é grossa: foi feita com duas falas reais e com a mesma fala
acelerada e amplificada (arousal 0,18 → 0,33 → 0,43 → 0,52). Para ajustá-la
com as vozes do grupo:

```bash
uv run python -m ml.check_emotion gravacoes/
```

Cada arquivo nomeado com a emoção esperada — `bravo_pedro_01.wav` — entra na
contagem de acertos, e a tabela mostra onde os cortes estão apertados demais.

### Recomendações (Random Forest)

O modelo, o dataset, as regras da equipe, a política de quando avaliar e a
evidência de teste estão documentados em **[`ml/README.md`](ml/README.md)**.

O app chama `trigger: "check"` a cada 5 minutos e **o backend decide se é
hora**: a cada 1 hora, ou quando o diário mostra uma mudança relevante. A
resposta diz se vale interromper o motorista (`notify`) e, com tensão forte na
voz, oferece a emergência antes de consultar o modelo (`assistance`).

### Erros

Toda falha sai no mesmo envelope:

```json
{ "error": { "code": "route_provider_timeout", "message": "..." } }
```

O `code` é estável e é o que o aplicativo usa para escolher a mensagem de tela,
como já fazia com `HttpError.kind` em `utils/http.ts`.

| `code` | HTTP | Quando |
|---|---|---|
| `invalid_request` | 422 | Corpo ou parâmetro malformado — coordenada fora de faixa, categoria inexistente. |
| `place_not_found` | 404 | Identificador de lugar que não existe. |
| `route_not_found` | 404 | Não há trajeto entre os pontos. Resposta legítima, não falha. |
| `route_provider_unavailable` | 502 | O provider de rotas recusou, caiu ou respondeu mal. |
| `route_provider_timeout` | 504 | O provider não respondeu no tempo limite. |
| `trip_not_found` | 404 | Viagem inexistente ou de outro aparelho. |
| `trip_already_finished` | 409 | Evento, parada ou encerramento numa viagem já encerrada. |
| `model_unavailable` | 503 | O modelo não foi treinado ou não carregou — rode `ml/train.py`. |
| `simulation_disabled` | 403 | Modo de demonstração desligado (`ATLAS_ML_SIMULATION_ENABLED=false`). |
| `recommendation_not_found` | 404 | Recomendação que não é desta viagem. |
| `invalid_audio` | 422 | O áudio não é legível, está mudo, é curto demais ou passa de 2 MB. |
| `vision_unavailable` | 503 | O classificador de imagem está carregando, desligado ou sem o extra `vision`. |
| `invalid_image` | 422 | O arquivo enviado não é uma imagem, está vazio ou passa de 5 MB. |
| `nearby_unavailable` | 502 | Nenhuma fonte de lugares próximos respondeu, nem o OpenStreetMap. |
| `database_unavailable` | 503 | O Supabase não respondeu. |
| `internal_error` | 500 | Falha não prevista. O detalhe fica no log, nunca no corpo. |

---

## Arquitetura

Organizada por camada, com a mesma inversão que o aplicativo já usa: quem está
acima só conhece o contrato de quem está abaixo.

```
backend/
├── app/
│   ├── main.py                  # Aplicação, lifespan e middlewares
│   ├── core/
│   │   ├── config.py            # Variáveis de ambiente, lidas uma vez
│   │   ├── errors.py            # Erros de domínio e o envelope único
│   │   ├── database.py          # Cliente do Supabase (PostgREST)
│   │   └── dependencies.py      # Montagem por Depends
│   ├── providers/
│   │   ├── base.py              # Protocolo RouteProvider
│   │   └── osrm.py              # Implementação OSRM
│   ├── repositories/
│   │   ├── place_repository.py
│   │   └── route_cache_repository.py
│   ├── services/
│   │   ├── place_service.py
│   │   └── route_service.py     # cache → provider → cache
│   ├── routers/                 # health, places, routes
│   └── schemas/                 # Contrato HTTP (camelCase na borda)
├── migrations/                  # Esquema do banco, versionado
└── tests/                       # Sem rede: respx + banco dublado
```

### Por que não o SDK do Supabase

A API usa duas tabelas e quatro operações. O PostgREST responde a isso com HTTP
puro, e já existe um cliente `httpx` no processo para falar com o provider de
rotas. Um cliente só, uma forma só de tratar timeout e erro — a mesma escolha
que o aplicativo fez em `utils/http.ts` ao dispensar o Axios.

### O caminho de uma rota

```
POST /v1/routes
      │
      ▼
RouteService.get_route
      │
      ├─ 1. chave determinística (sha256 de provider + coordenadas a 4 casas)
      ├─ 2. route_cache  ──── acertou? ──→ devolve com cached: true
      ├─ 3. RouteProvider (OSRM)
      ├─ 4. grava no route_cache
      └─ 5. devolve com cached: false
```

Quatro casas decimais ≈ 11 m. Abaixo disso o trajeto calculado é o mesmo, e
cada casa a mais só fragmenta o cache sem melhorar a resposta.

Medido no trajeto Campinas → Ibirapuera (1.444 pontos, 104 km): **1.767 ms** na
primeira chamada, **98 ms** na segunda. A geometria volta do banco idêntica,
ponto a ponto.

Uma falha no cache — leitura ou escrita — **não** derruba a resposta: a rota
sai do provider, com um aviso no log. O cache é conveniência; o provider é a
fonte da verdade.

O cache guarda as manobras junto com a geometria. Sem isso ele mentiria por
omissão: a primeira consulta traria as instruções e a segunda, servida do
cache, devolveria a mesma rota sem manobra nenhuma — e a faixa desapareceria
da tela sem motivo visível.

### Banco

| Tabela | Papel | RLS |
|---|---|---|
| `places` | Catálogo de destinos. Dado público. | Leitura liberada para `anon`. |
| `route_cache` | Rotas já calculadas, com validade e manobras. Dado interno. | **Sem policy**, de propósito. |
| `devices`, `trips`, `trip_events`, `stops`, `photos`, `recommendations` | Viagens, diário e histórico (escopo §10). | **Sem policy** — só a chave de serviço. |

`route_cache` não tem policy alguma para que só este processo, com a chave de
serviço, o alcance. Um cliente com a chave `anon` não lê nem escreve — o
Supabase sinaliza isso como aviso `INFO` no linter, e aqui é a configuração
pretendida.

As migrações ficam em [`migrations/`](migrations/README.md), em ordem, para que
o banco seja reproduzível a partir do zero.

A função `search_places` resolve a busca no banco. O termo do usuário vai como
argumento, nunca como sintaxe, e o `unaccent` roda dos dois lados da comparação.

---

## Como rodar

```bash
cd backend
uv venv
uv pip install -e ".[dev]"
cp .env.example .env
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8787
```

`--host 0.0.0.0` é necessário para o Expo Go alcançar a API: o aplicativo roda
em outro aparelho da rede, e `127.0.0.1` só responde à própria máquina.

Depois aponte o aplicativo para ela, no `.env` da raiz do projeto:

```
EXPO_PUBLIC_ATLAS_API_URL=http://192.168.0.10:8787
```

O endereço é o IP da máquina na rede local. Sem essa variável o aplicativo não
muda de comportamento: continua chamando o OSRM direto e usando a lista local
de lugares.

### Configuração

Tudo por variável de ambiente, com o prefixo `ATLAS_`. Ver `.env.example`.

A que mais importa é `ATLAS_SUPABASE_SERVICE_KEY`: a chave `service_role`, em
*Project Settings → API Keys*. Ela ignora RLS de propósito — é ela que lê e
escreve o `route_cache`.

Se por acidente a chave `anon` entrar no lugar dela, a falha é silenciosa e
fácil de diagnosticar: o catálogo de lugares continua funcionando, o cache de
rotas fica inerte, e o log repete `Cache de rotas indisponível na escrita`. É
o comportamento projetado — o cache é conveniência, não requisito.

### Testes

```bash
uv run pytest
uv run ruff check .
```

Nada toca a rede: o OSRM é interceptado por `respx` e o Supabase é substituído
por um dublê em memória. Rodam sem projeto Supabase, sem OSRM e sem simulador.

---

## ⚠️ OSRM público continua temporário

`router.project-osrm.org` é o servidor de demonstração do projeto OSRM: sem
SLA, sem uso comercial, com limites de requisição não documentados. O cache
reduz bastante a pressão sobre ele, mas não legitima o uso em produção.

Antes de distribuir, aponte `ATLAS_OSRM_BASE_URL` para uma instância própria,
ou escreva outro provider: uma classe que cumpra o protocolo de
`providers/base.py` e uma linha em `main.py`. Nenhum router muda, e o
aplicativo não percebe.

---

## Próximos passos

1. **Busca de endereço por texto** (RF-04) — hoje o texto busca só os lugares
   salvos. O *Text Search* do Places resolve, em outro SKU.
2. **Calibrar a emoção** com as vozes do grupo (`ml/check_emotion.py`) e
   registrar a tabela no relatório.
3. **Limpeza do cache** — um `pg_cron` diário apagando linhas vencidas.

Não há autenticação no plano: o escopo exclui login, e o aparelho é
identificado pelo UUID anônimo.
