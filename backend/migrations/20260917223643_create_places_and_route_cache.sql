-- Atlas — esquema inicial da API (fase backend).
--
-- Duas tabelas, dois papéis distintos:
--   places      → catálogo de destinos. Dado público, lido pelo app via API.
--   route_cache → memória de rotas já calculadas, para não repetir chamada
--                 ao provider externo. Dado interno, nunca exposto ao app.

create extension if not exists unaccent with schema extensions;

create type place_category as enum ('fuel', 'food', 'parking', 'saved');

create table places (
  id          text primary key,
  name        text not null,
  address     text not null,
  category    place_category not null,
  saved       boolean not null default false,
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  created_at  timestamptz not null default now()
);

-- Os filtros da tela "Definir destino" consultam por categoria.
create index places_category_idx on places (category);

-- `extensions.unaccent` é declarada STABLE, não IMMUTABLE, e por isso não pode
-- entrar direto num índice. Este wrapper fixa o dicionário e assume a
-- imutabilidade — legítima aqui, porque o dicionário é constante.
create function public.immutable_unaccent(text)
  returns text
  language sql
  immutable
  strict
  parallel safe
  set search_path = ''
  as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- Busca por texto insensível a acento e caixa, espelhando filter-places.ts.
create index places_search_idx on places
  using gin (to_tsvector('simple', public.immutable_unaccent(name || ' ' || address)));

create table route_cache (
  -- Hash determinístico de origem + destino + perfil, calculado pela API.
  cache_key         text primary key,
  provider          text not null,
  origin_latitude   double precision not null,
  origin_longitude  double precision not null,
  dest_latitude     double precision not null,
  dest_longitude    double precision not null,
  distance_meters   double precision not null,
  duration_seconds  double precision not null,
  -- Geometria como array GeoJSON [[lon, lat], ...], já validada na escrita.
  geometry          jsonb not null,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null
);

-- A limpeza e a checagem de validade varrem por expiração.
create index route_cache_expires_at_idx on route_cache (expires_at);

alter table places enable row level security;
alter table route_cache enable row level security;

-- O catálogo de lugares é público para leitura: nada aqui é do usuário.
create policy places_are_publicly_readable
  on places for select
  to anon, authenticated
  using (true);

-- route_cache não recebe nenhuma policy de propósito: só a API, com a chave
-- de service role, escreve e lê o cache. Ninguém alcança pelo cliente.
