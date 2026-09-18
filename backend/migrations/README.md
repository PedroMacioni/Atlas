# Migrações

O esquema do banco, em ordem. Aplicadas no projeto Supabase do Atlas e
versionadas aqui para que o banco seja reproduzível — um projeto novo sai do
zero rodando estes arquivos na ordem do nome.

| Arquivo | O que faz |
|---|---|
| `20260917223643_create_places_and_route_cache.sql` | Tabelas `places` e `route_cache`, índices, RLS e o wrapper imutável de `unaccent`. |
| `20260917223656_seed_demo_places.sql` | Os oito lugares que vinham no bundle do aplicativo. |
| `20260917223946_create_search_places_function.sql` | `search_places`, a busca insensível a acento. |
| `20260917224641_fix_saved_filter_semantics.sql` | `saved` passa a filtrar pela marcação do usuário, não pela categoria. |
| `20260917234029_add_place_priority.sql` | Coluna `priority`: ordem explícita no catálogo, acima do alfabeto. |
| `20260917234047_seed_anhanguera_taquaral.sql` | Faculdade Anhanguera (Taquaral, Campinas) como destino no topo. |
| `20260918013453_add_route_cache_steps.sql` | Coluna `steps`: as manobras sobrevivem ao cache. |
| `20260918025647_create_trips_journal.sql` | `devices`, `trips`, `trip_events`, `stops`, `photos`, `recommendations` — viagens, diário de bordo e histórico sem login (escopo §8 e §10). |
| `20260918040306_recommendation_features.sql` | `recommendations` guarda as 6 variáveis, as probabilidades, o gatilho, a versão do modelo e se foi simulação — os testes reais viram dataset. |
| `20260918112314_seed_marechal_rondon_700.sql` | Av. Marechal Rondon, 700 (Jardim Chapadão, Campinas) nos salvos, logo abaixo da faculdade. |

## Como aplicar

Com a CLI do Supabase, a partir de `backend/`:

```bash
supabase link --project-ref SEU_REF
supabase db push
```

Ou cole o conteúdo de cada arquivo, na ordem, no SQL Editor do painel.

## Convenção

Um arquivo por mudança, nomeado `<timestamp>_<nome_em_snake_case>.sql`, com
o timestamp **completo** (14 dígitos, `AAAAMMDDHHMMSS`) — é a versão que o
Supabase grava em `schema_migrations`, e duas migrações com a mesma versão
colidem. O nome do arquivo deve bater com a versão aplicada no projeto, e
nunca editado depois de aplicado — uma correção é uma migração nova, como
`fix_saved_filter_semantics` corrigiu a função criada duas migrações antes.
