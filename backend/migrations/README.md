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

## Como aplicar

Com a CLI do Supabase, a partir de `backend/`:

```bash
supabase link --project-ref SEU_REF
supabase db push
```

Ou cole o conteúdo de cada arquivo, na ordem, no SQL Editor do painel.

## Convenção

Um arquivo por mudança, nomeado `<timestamp>_<nome_em_snake_case>.sql`, e
nunca editado depois de aplicado — uma correção é uma migração nova, como
`fix_saved_filter_semantics` corrigiu a função criada duas migrações antes.
