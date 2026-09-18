-- Manobras no cache de rotas.
--
-- Sem esta coluna o cache passaria a mentir por omissão: a primeira consulta
-- traria as instruções do provider e a segunda — servida do cache — devolveria
-- a mesma rota sem manobra nenhuma, fazendo a faixa de instrução desaparecer
-- da tela sem motivo visível.
--
-- `default '[]'` mantém válidas as linhas gravadas antes das manobras
-- existirem: elas simplesmente não têm instruções, e o app trata lista vazia
-- como ausência.
alter table route_cache
  add column steps jsonb not null default '[]'::jsonb;

comment on column route_cache.steps is
  'Manobras do trajeto, como a API as devolve. Lista vazia = provider sem instruções.';
