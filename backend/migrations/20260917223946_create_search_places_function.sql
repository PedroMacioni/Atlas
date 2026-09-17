-- Busca de lugares no banco, com a mesma regra de filter-places.ts:
-- insensível a acento e a caixa, casando por nome ou endereço.
--
-- Existe como função (e não como filtro montado na API) por três razões:
-- o termo do usuário nunca é interpolado em sintaxe de query, o `unaccent`
-- roda dos dois lados da comparação, e a ordenação — salvos primeiro, depois
-- alfabética — fica declarada num lugar só.
create function public.search_places(
  search_query  text default null,
  filter_category place_category default null,
  result_limit  integer default 20
)
returns setof places
language sql
stable
set search_path = ''
as $$
  select p.*
  from public.places as p
  where (filter_category is null or p.category = filter_category)
    and (
      search_query is null
      or btrim(search_query) = ''
      or public.immutable_unaccent(lower(p.name || ' ' || p.address))
         like '%' || public.immutable_unaccent(lower(btrim(search_query))) || '%'
    )
  order by p.saved desc, p.name asc
  limit least(greatest(coalesce(result_limit, 20), 1), 100);
$$;

-- A função é lida pelo app através da API, que usa a chave de serviço; anon
-- recebe o mesmo acesso de leitura que já tem na tabela.
grant execute on function public.search_places(text, place_category, integer)
  to anon, authenticated, service_role;
