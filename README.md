# Atlas

Copiloto inteligente de viagem — **Fase 2: backend e API**.

---

## 1. Objetivo atual

A fase 1 validou um eixo técnico, de ponta a ponta:

```
Expo + React Native + Localização + Mapa + Rotas
```

A fase 2 acrescentou o segundo:

```
FastAPI + Supabase + cache de rotas + catálogo de lugares
```

O backend vive em [`backend/`](backend/README.md) e tem o seu próprio README.
Ainda não há autenticação nem inteligência de qualquer tipo.

O aplicativo continua funcionando **sem** o backend: sem
`EXPO_PUBLIC_ATLAS_API_URL` definida, ele chama o OSRM direto e usa a lista
local de lugares, exatamente como na fase 1. Definir a variável move as
chamadas para a API sem tocar em nenhuma tela.

O que o aplicativo faz hoje:

1. Pede permissão de localização em primeiro plano ao abrir.
2. Mostra um mapa com o indicador azul nativo da sua posição.
3. Marca uma origem (Campinas) e um destino (Aeroporto de Viracopos).
4. Consulta uma rota real entre os dois pontos.
5. Desenha a rota sobre o mapa como uma `Polyline`.
6. Enquadra a rota inteira automaticamente assim que ela chega.
7. Exibe distância e tempo estimado devolvidos pelo serviço de rotas.
8. Oferece um botão **Centralizar rota** para reenquadrar o trajeto.

A interface segue o design de referência do ATLAS: tipografia Plus Jakarta
Sans, cards arredondados com elevação suave, pílulas de contexto no topo, o
mapa como card e botões em pílula com gradiente.

> **Nota sobre componentes nativos.** A navegação é a **barra de abas nativa**
> (`NativeTabs`): `UITabBar` no iOS, `BottomNavigationView` Material 3 no
> Android. Os botões, ao contrário, são desenhados — o botão primário do design
> tem gradiente e sombra, que o `Button` do sistema não expressa. É uma divisão
> deliberada: nativo onde a plataforma tem opinião (navegação), custom onde o
> design tem (ações).

### As três telas

Duas abas e uma tela empilhada por cima delas:

| Tela | Onde vive | Papel |
|---|---|---|
| **Início** | aba | Boas-vindas. Mostra onde o usuário está e convida a começar. Não consulta rotas. |
| **Sobre** | aba | Contexto. Procedência dos números, acesso rápido e arquitetura. |
| **Definir destino** | empilhada | Busca por texto, filtros por categoria e lista de lugares. |
| **Viagem** | empilhada | Operação. Mapa com a rota real, distância e tempo do serviço, e o botão de reenquadrar. |

O fluxo é `Início → Definir destino → Viagem`, com `router.push`. As duas
últimas sobem por cima das abas e usam o **cabeçalho nativo** do `Stack` —
seta, gesto de voltar e `Toolbar` da própria plataforma, só com a tipografia
alinhada ao tema.

### Definir destino

Funciona de verdade, sem Google Places: a busca filtra uma lista local de oito
lugares com **coordenadas reais**, e escolher um deles calcula a rota até ele.

- **Campo "Para onde?"** com lupa, microfone à direita (atenuado — voz é fase
  futura) e botão de limpar que ocupa o lugar do microfone quando há texto.
- **Filtros**: Posto, Comida, Estacionar, Salvos. Tocar de novo desmarca.
- **Busca insensível a acento e caixa** — "sao paulo" encontra "São Paulo".
  A lógica é uma função pura em `features/destination/utils/filter-places.ts`.

O destino escolhido vai para a Viagem por query params, e `trip.tsx` cai no
trajeto de demonstração se a coordenada vier inválida.

A hierarquia de rotas reflete isso: o grupo `(tabs)` guarda a barra nativa, e
`trip.tsx` fica fora dele, como irmão na pilha da raiz.

Nem a Início nem a Viagem **rolam**. O cabeçalho, os botões e os cards
têm altura de conteúdo, e o mapa é o único elemento elástico — encolhe ou
cresce para fechar a conta. Isso mantém o mapa dominante em telas grandes,
ainda legível em aparelhos pequenos, e elimina a competição de gesto entre o
arrasto do mapa e o rolamento da tela.

### O que aparece mas não funciona

Dois elementos do design existem como casca visual, atenuados e marcados
**"Em breve"**, porque as capacidades que eles representam são fases futuras:

- **`Diga "Atlas" para começar`** — reconhecimento de fala exige módulo nativo
  de terceiros que não roda no Expo Go.
- **Chips de categoria** (posto, restaurante, hotel, hospital) — dependem do
  Google Places.

Nenhum dos dois é tocável. Um microfone que não ouve é pior que um microfone
ausente, e o mesmo vale para um botão que não busca nada.

---

## 2. Arquitetura

O código é organizado por **feature**, não por tipo de arquivo. Cada feature é
autossuficiente e expõe apenas o que outras camadas precisam consumir.

```
atlas/
├── src/
│   ├── app/                        # Somente rotas do Expo Router — sem lógica
│   │   ├── _layout.tsx             # Fontes + provedores globais + Stack raiz
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx         # Barra de abas nativa
│   │   │   ├── index.tsx           # Aba "Início" (boas-vindas, sem rolagem)
│   │   │   └── about.tsx           # Aba "Sobre"
│   │   ├── destination.tsx         # Tela "Definir destino", empilhada
│   │   └── trip.tsx                # Tela "Viagem", empilhada
│   │
│   ├── components/ui/              # Design system
│   │   ├── app-tabs.tsx            # NativeTabs (UITabBar / BottomNavigationView)
│   │   ├── search-field.tsx        # Campo de busca com microfone
│   │   ├── place-row.tsx           # Linha de lugar em lista
│   │   ├── section-header.tsx      # Título de seção com nota à direita
│   │   ├── voice-prompt-card.tsx   # Chamada de voz (inerte nesta fase)
│   │   ├── text.tsx                # Único componente de texto do app
│   │   ├── card.tsx                # Superfície arredondada com elevação
│   │   ├── icon-badge.tsx          # Ícone dentro de círculo suave
│   │   ├── primary-button.tsx      # Pílula com gradiente + háptico
│   │   ├── secondary-button.tsx    # Pílula azul clara
│   │   ├── status-pill.tsx         # Pílula de contexto do topo
│   │   ├── metric-tile.tsx         # Bloco de métrica
│   │   ├── category-chip.tsx       # Bloco quadrado de categoria
│   │   ├── app-header.tsx          # Cabeçalho de marca com safe area
│   │   └── status-message.tsx      # Faixa de carregando / erro / retry
│   │
│   ├── config/
│   │   └── api.ts                  # EXPO_PUBLIC_ATLAS_API_URL e as URLs
│   │
│   ├── features/
│   │   ├── destination/
│   │   │   ├── constants/{demo-places,place-categories}.ts
│   │   │   ├── hooks/use-place-search.ts
│   │   │   ├── services/place-service.ts   # API do Atlas ou lista local
│   │   │   ├── types/place.ts
│   │   │   └── utils/filter-places.ts
│   │   ├── location/
│   │   │   ├── hooks/use-current-location.ts
│   │   │   └── services/location-service.ts
│   │   ├── map/
│   │   │   ├── components/atlas-map.tsx
│   │   │   ├── constants/map-style.ts
│   │   │   └── types/coordinate.ts
│   │   ├── routing/
│   │   │   ├── providers/atlas-route-provider.ts   # fala com o backend
│   │   │   ├── providers/osrm-route-provider.ts    # direto, sem backend
│   │   │   ├── services/route-service.ts
│   │   │   └── types/route-provider.ts, route-result.ts
│   │   └── trip/
│   │       ├── components/trip-summary-card.tsx
│   │       ├── constants/demo-route.ts
│   │       └── hooks/use-trip-route.ts
│   │
│   ├── theme/                      # colors, typography, spacing, radius, shadows
│   └── utils/                      # http.ts, distance.ts, duration.ts
│
├── backend/                        # API do Atlas — FastAPI + Supabase
│   ├── app/                        # ver backend/README.md
│   ├── tests/
│   ├── pyproject.toml
│   └── .env.example
│
├── assets/
├── app.json
├── package.json
├── .env.example                    # EXPO_PUBLIC_ATLAS_API_URL
└── tsconfig.json
```

> **Nota sobre `src/app/`** — o template oficial do SDK 57 posiciona o diretório
> de rotas em `src/app/`, e não na raiz. O projeto segue o padrão atual do Expo.
> A regra que importa foi mantida integralmente: **nenhum componente ou serviço
> vive dentro do diretório de rotas**.

### Regras que o projeto segue

| Regra | Por quê |
|---|---|
| `src/app/` contém **apenas rotas** | Componentes e serviços vivem em `features/` e `components/`; as telas só compõem. |
| Arquivos em **kebab-case** | Consistência e previsibilidade em sistemas de arquivo case-insensitive. |
| Alias `@/*` para `src/*` | Nenhum `../../../` no projeto. |
| Nenhum hexadecimal fora de `theme/colors.ts` | A identidade visual muda em um arquivo só. |
| Nenhum `fontSize` ou `fontFamily` fora de `theme/typography.ts` | Todo texto passa pelo componente `Text` e por uma variante nomeada. |
| Nenhum `fetch` solto em componente | Toda rede passa por `utils/http.ts`. |
| Nenhuma URL de serviço fora de `config/api.ts` | O endereço da API muda em um arquivo só. |
| Nenhuma chave de API no aplicativo | Credenciais vivem no backend. `EXPO_PUBLIC_` é texto puro no bundle. |
| Nenhum `Dimensions.get` | Layout só com flexbox e `react-native-safe-area-context`. |
| Nenhuma coordenada literal em telas | Ficam em `features/trip/constants/demo-route.ts`. |

### Design system

Todo o visual vem de `src/theme/` e `src/components/ui/`. Nenhuma tela declara
cor, fonte ou sombra diretamente.

| Arquivo | O que define |
|---|---|
| `theme/colors.ts` | Paleta, gradiente primário e as cinco cores de categoria. |
| `theme/typography.ts` | Família Plus Jakarta Sans e oito variantes nomeadas (`wordmark`, `title`, `heading`, `metric`, `body`, `bodySoft`, `label`, `action`). |
| `theme/spacing.ts` | Escala de 4pt. |
| `theme/radius.ts` | Raios, incluindo `pill` para os botões. |
| `theme/shadows.ts` | Duas elevações (`card` e `raised`), já resolvidas por plataforma. |

Os componentes são combináveis e não conhecem domínio: `Card`, `Text`,
`IconBadge`, `PrimaryButton`, `SecondaryButton`, `StatusPill`, `MetricTile`,
`CategoryChip`, `StatusMessage`, `VoicePromptCard`, `SearchField`, `PlaceRow`,
`SectionHeader`. As telas e as features compõem a partir deles.

### Separação entre origem e localização

`origin` e `currentLocation` são conceitos distintos e nunca são confundidos:

- **`origin`** — o ponto de partida da viagem. Hoje é a posição do aparelho,
  e cai em `DEMO_ORIGIN` se o GPS falhar ou a permissão for negada.
- **`currentLocation`** — a leitura crua do GPS, que alimenta o indicador azul
  nativo do mapa.

Continuam separados porque vão divergir: numa etapa futura o usuário poderá
definir uma origem diferente de onde está — planejar hoje uma viagem que
começa amanhã em outro lugar. O cálculo da rota espera a localização resolver
antes de consultar o serviço, para não gastar uma chamada com origem
provisória.

O aplicativo funciona por completo mesmo sem localização: se a permissão for
negada ou o GPS falhar, o mapa e a rota continuam visíveis e apenas um aviso
aparece sobre o mapa.

---

## 3. Dependências

Nenhuma versão foi fixada manualmente — todas foram resolvidas por
`npx expo install`, que escolhe o que é compatível com o SDK.

| Pacote | Papel |
|---|---|
| `expo` ~57 / `react-native` 0.86 | Plataforma (SDK estável mais recente). |
| `expo-router` | Navegação baseada em arquivos e `NativeTabs`. |
| `react-native-maps` | Mapa, marcadores, `Polyline` e estilo customizado. |
| `expo-location` | Permissão de foreground e leitura do GPS. |
| `expo-font` + `expo-asset` + `@expo-google-fonts/plus-jakarta-sans` | Tipografia do design. |
| `@expo/vector-icons` | Ícones com cor de categoria nas duas plataformas. |
| `expo-linear-gradient` | Gradiente do botão primário. |
| `expo-haptics` | Retorno tátil leve nos botões. |
| `react-native-safe-area-context` | Recortes de tela (Dynamic Island, barra de status). |
| `expo-image` | Reservado para as próximas fases; ainda não utilizado. |

Sobre os ícones: o design pede a mesma cor de categoria no iOS e no Android
(bomba azul, garfo laranja, cama roxa, cruz vermelha). SF Symbols não existe no
Android, então `@expo/vector-icons` entrou no lugar. É a única biblioteca de
interface do projeto.

**Sem Axios.** As chamadas HTTP usam o `fetch` nativo, encapsulado em
`src/utils/http.ts` com `AbortController`, timeout de 12 s e classificação
explícita de falhas (`timeout`, `network`, `status`, `invalid-response`).

---

## 4. Como instalar

```bash
cd atlas
npm install
```

## 5. Como iniciar

```bash
npx expo start
```

## 6. Como testar no Expo Go

1. Instale o **Expo Go** no aparelho (iOS ou Android).
2. Garanta que o computador e o telefone estão na **mesma rede Wi-Fi**.
3. Rode `npx expo start`.
4. Escaneie o QR Code — câmera no iOS, aplicativo Expo Go no Android.
5. Aceite o pedido de permissão de localização quando ele aparecer.

Se a rede bloquear a descoberta local, use um túnel:

```bash
npx expo start --tunnel
```

Tudo nesta fase roda no Expo Go — `react-native-maps`, `expo-location`,
`expo-font`, `expo-linear-gradient` e as fontes do Google já funcionam sem
compilar nada. **Nenhum development build é necessário.**

> No Expo Go, o mapa usa a chave do Google Maps do próprio Expo Go. Ao gerar um
> build próprio para Android será preciso configurar uma chave sua no plugin do
> `react-native-maps`.

### ⚠️ O mapa não fica idêntico no iOS

`customMapStyle` — o estilo claro e pastel do design — é aplicado **somente no
Android** e, no iOS, **apenas quando o provider é o Google Maps**. A própria
tipagem do `react-native-maps` diz isso: *"iOS: Google Maps only / Android:
supported"*.

No Expo Go o iOS usa Apple Maps, então no iPhone o mapa aparece com o visual
padrão do sistema. Todo o resto da tela — tipografia, cards, pílulas, métricas,
botões — fica igual nas duas plataformas.

Para igualar o iOS é preciso um development build com chave própria do Google
Maps e `provider={PROVIDER_GOOGLE}`. Fica para quando o Expo Go deixar de ser
requisito.

### Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento. |
| `npm run android` / `npm run ios` | Abre direto na plataforma escolhida. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint com a configuração oficial do Expo. |
| `npm run verify` | Typecheck + lint. |

---

## 7. Como funciona o provider de rotas

A camada de rotas tem três peças, e a interface só conhece a do meio:

```
                        ┌──────────────────────────┐
  Telas e componentes → │  route-service.getRoute  │ → RouteResult
                        └────────────┬─────────────┘
                                     │  seleciona
                        ┌────────────▼─────────────┐
                        │   RouteProvider (tipo)   │
                        └────────────┬─────────────┘
                                     │  implementado por
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
     osrm-route-provider    google-routes-provider    mapbox-provider
        (implementado)          (futuro)                (futuro)
```

O contrato é único e mínimo:

```ts
getRoute({ origin, destination }) // devolve:
{
  coordinates: Coordinate[];   // já em latitude/longitude
  distanceMeters: number;
  durationSeconds: number;
}
```

`RouteResult` é o **único** formato que a interface enxerga. Cada provider é
responsável por traduzir o formato do seu serviço para esse tipo — incluindo a
inversão de eixos do GeoJSON, que usa `[longitude, latitude]`.

---

## 8. Por que OSRM nesta etapa

O servidor `https://router.project-osrm.org` devolve rotas reais, com geometria
completa, **sem chave de API e sem cadastro**. Isso permite validar o fluxo
inteiro — mapa, `Polyline`, distância, duração e enquadramento — sem nenhum
custo ou burocracia antes de saber se a arquitetura se sustenta.

> ### ⚠️ OSRM público é temporário
>
> `router.project-osrm.org` é um servidor de **demonstração** mantido pelo
> projeto OSRM. Ele não tem SLA, não permite uso comercial, aplica limites de
> requisição não documentados e pode ficar indisponível sem aviso.
>
> **Não distribua o Atlas usando este endpoint.** O aviso também está no topo
> de `src/features/routing/providers/osrm-route-provider.ts`.

A requisição usa `overview=full` e `geometries=geojson` — GeoJSON em vez de
polyline codificada, para não precisar de um decodificador nesta fase.

---

## 9. Como substituir o OSRM

Trocar de provider é escrever um arquivo e mudar uma linha. Nenhum componente
de interface é tocado.

**Passo 1** — criar `src/features/routing/providers/google-routes-provider.ts`:

```ts
import type { RouteProvider } from '@/features/routing/types/route-provider';

export const googleRoutesProvider: RouteProvider = {
  id: 'google-routes',
  async getRoute({ origin, destination, signal }) {
    // chamar a API, traduzir a resposta e devolver um RouteResult
  },
};
```

**Passo 2** — registrá-lo em `src/features/routing/services/route-service.ts`:

```ts
import { googleRoutesProvider } from '@/features/routing/providers/google-routes-provider';

let activeProvider: RouteProvider = googleRoutesProvider;
```

Também é possível trocar em tempo de execução com `setRouteProvider(...)` —
útil para uma feature flag ou para injetar um provider falso em testes.

Ao migrar para Google Routes ou Mapbox, lembre-se de que ambos devolvem a
geometria como **polyline codificada** por padrão. Peça GeoJSON, ou decodifique
dentro do provider — a tradução é responsabilidade dele, não da interface.

---

## 10. A API do Atlas

O backend tem README próprio, com os endpoints, o envelope de erro e o esquema
do banco: **[`backend/README.md`](backend/README.md)**.

O que ele muda no lado do aplicativo:

| Antes | Agora |
|---|---|
| `osrmRouteProvider` chamava o OSRM público do aparelho. | `atlasRouteProvider` chama `POST /v1/routes`; o backend decide o provider e guarda o resultado em cache. |
| `DEMO_PLACES` vinha no bundle. | `place-service` consulta `GET /v1/places`, com busca e filtro no banco — e cai na lista local se a rede falhar. |
| Cada abertura da Viagem gastava uma chamada ao OSRM. | O trajeto repetido vem do `route_cache`: 1.767 ms na primeira vez, 98 ms depois. |
| Uma chave de API precisaria ser embarcada. | As chaves ficam no servidor. Só a URL da API entra no bundle. |

Três arquivos novos no aplicativo, e nenhuma tela reescrita:

| Arquivo | Papel |
|---|---|
| `config/api.ts` | Lê `EXPO_PUBLIC_ATLAS_API_URL` e monta as URLs. |
| `features/routing/providers/atlas-route-provider.ts` | Provider de rotas que fala com a API. |
| `features/destination/services/place-service.ts` | Catálogo de lugares, com as duas fontes atrás de uma assinatura. |

`route-service.ts` escolhe o provider por configuração, e não por `__DEV__`:
quem clona o projeto e roda `npx expo start` sem subir o backend continua
vendo o aplicativo funcionar de ponta a ponta.

`utils/http.ts` ganhou `POST` e passou a ler o envelope de erro da API — o
`code` estável (`route_not_found`, `route_provider_timeout`) chega às telas
pelo `HttpError.code`, ao lado do `kind` que já existia.

A tela **Definir destino** passou a ter estado de rede, porque agora existe
rede: um debounce de 250 ms para não disparar uma chamada por tecla,
cancelamento para que uma resposta atrasada não sobrescreva uma busca mais
recente, e uma faixa de aviso quando o resultado exibido veio da cópia local.

---

## 11. Próximos passos

Em ordem sugerida:

0. **As outras cinco telas do design** — Definir destino, Opções próximas,
   Viagem em andamento, Recomendação e Resumo da viagem. O design system já
   cobre todos os elementos que elas usam; falta o conteúdo real de cada uma
   (Places, voz, modelo de recomendação, histórico).
1. **Provider de produção** — Google Routes ou Mapbox. Agora é uma troca no
   backend, com a chave do lado do servidor, e não um release na loja.
2. **Testes do aplicativo** — o backend já tem 30; do lado do app, os
   utilitários puros (`distance`, `duration`, `filter-places`) e o parsing dos
   providers estão isolados o bastante para serem testados sem simulador.
3. **Recentralizar no usuário** — botão para voltar a câmera à posição atual,
   separado do enquadramento da rota.
4. **Rotas alternativas** — o contrato `RouteResult` precisará virar uma lista.
5. **Development build** — necessário assim que entrar um módulo nativo fora do
   Expo Go (voz, câmera avançada, mapas com chave própria).

---

## Future architecture

| Camada | Tecnologia | Papel | Estado |
|---|---|---|---|
| Backend | **FastAPI / Python** | Orquestração, cache de rotas, chaves de API fora do app. | **Implementado** |
| Dados | **Supabase** | Catálogo de lugares e cache de rotas hoje; autenticação e perfis depois. | **Parcial** — banco sim, auth não |
| Inteligência | **Random Forest** | Previsão de tempo de trajeto a partir de histórico e contexto. | Previsto |
| Visão | **Classificação de imagem** | Reconhecimento de pontos de interesse e placas. | Previsto |
| Áudio | **Análise de voz** | Comandos e interação em viagem, sem uso das mãos. | Previsto |
| Lugares | **Google Places** | Busca de endereços, autocomplete e metadados de destinos. | Previsto |
| Histórico | Supabase + FastAPI | Viagens anteriores alimentando o modelo de previsão. | Previsto |

O que já está pronto para receber o resto:

- `RouteProvider` isola o serviço de rotas, no app **e** no backend — o mesmo
  contrato nas duas pontas. A previsão do Random Forest pode entrar como um
  ajuste sobre `durationSeconds`, dentro do `route_service` do backend, sem
  que o aplicativo perceba.
- `utils/http.ts` centraliza timeout, erro e agora o envelope da API;
  autenticação entra em um lugar só, tanto no app quanto no `core/database.py`.
- A organização por feature — nas duas pontas — permite adicionar
  `features/auth`, `features/voice` ou `features/history` sem tocar no que
  existe.
- O prefixo `/v1` nas rotas deixa espaço para evoluir o contrato sem romper
  aplicativos já instalados.
