# Atlas API

Backend do Atlas — **FastAPI + Supabase**. Três responsabilidades nesta fase:

1. **Guardar as chaves.** Nenhuma credencial precisa existir dentro do
   aplicativo. Uma variável `EXPO_PUBLIC_` é inlinada no bundle e fica legível
   em texto puro; uma chave de serviço no servidor não.
2. **Absorver o provider externo.** O app pede uma rota à API, e a API decide
   se responde do cache ou se chama o OSRM. Trocar de provider de rotas deixa
   de ser um release na loja.
3. **Servir o catálogo de lugares.** Os oito lugares de demonstração saem do
   bundle e viram dado, com busca e filtro resolvidos no banco.

Autenticação, histórico de viagens e o modelo de previsão são as fases
seguintes — o contrato de hoje foi desenhado para recebê-las.

---

## Endpoints

| Método | Rota | Papel |
|---|---|---|
| `GET` | `/health` | Diagnóstico: versão, ambiente, provider ativo e estado do banco. |
| `GET` | `/v1/places` | Lista lugares. Busca por texto e filtro por categoria. |
| `GET` | `/v1/places/{id}` | Um lugar pelo identificador. |
| `POST` | `/v1/routes` | Calcula a rota entre dois pontos. |

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
| `limit` | 1 a 100. Padrão 20. |

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

1. **Provider de produção** — Google Routes ou Mapbox, com a chave aqui e o
   OSRM restrito a desenvolvimento.
2. **Autenticação** — Supabase Auth, com o token vindo do app e o RLS passando
   a distinguir usuários. `places` ganha lugares salvos por pessoa.
3. **Histórico de viagens** — `POST /v1/trips`, que alimenta o modelo de
   previsão de tempo de trajeto.
4. **Limpeza do cache** — um `pg_cron` diário apagando linhas vencidas.
5. **Google Places** — entra em `place_service`, sem o router nem o app mudarem.
