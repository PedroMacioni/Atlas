-- `saved` não é uma categoria como as outras: é a marcação do usuário.
-- Um posto salvo continua sendo um posto, e precisa aparecer nos dois
-- filtros. É a mesma regra de filter-places.ts, que trata 'saved' pela
-- coluna `saved` e as demais pela coluna `category`.
create or replace function public.search_places(
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
  where (
      filter_category is null
      or (filter_category = 'saved' and p.saved)
      or (filter_category <> 'saved' and p.category = filter_category)
    )
    and (
      search_query is null
      or btrim(search_query) = ''
      or public.immutable_unaccent(lower(p.name || ' ' || p.address))
         like '%' || public.immutable_unaccent(lower(btrim(search_query))) || '%'
    )
  order by p.saved desc, p.name asc
  limit least(greatest(coalesce(result_limit, 20), 1), 100);
$$;
