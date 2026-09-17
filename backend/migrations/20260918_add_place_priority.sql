-- Ordem explícita no catálogo de lugares.
--
-- Até aqui a lista saía por `saved desc, name asc`, e a ordem alfabética não
-- expressa importância: o destino de todo dia ficava abaixo de um aeroporto
-- só porque "Aeroporto" vem antes de "Anhanguera". `priority` dá o controle
-- que faltava, sem tirar o alfabeto de quem empata.
--
-- Maior vem primeiro. O padrão 0 mantém todos os lugares existentes na ordem
-- em que já estavam.
alter table places
  add column priority integer not null default 0;

comment on column places.priority is
  'Ordem no catálogo: maior aparece antes. Empates caem no alfabeto.';

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
  order by p.saved desc, p.priority desc, p.name asc
  limit least(greatest(coalesce(result_limit, 20), 1), 100);
$$;
