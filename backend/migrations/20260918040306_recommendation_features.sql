-- O que o Random Forest viu e respondeu, em cada recomendação.
--
-- `features` guarda as 6 variáveis exatamente como entraram no modelo. É o que
-- transforma os testes reais em dataset (escopo §4.6): uma recomendação aceita
-- pelo usuário vira uma linha rotulada, com a situação que a gerou —
-- `ml/export_real_data.py` lê daqui.
--
-- `simulated` separa as avaliações do modo de demonstração, que nunca entram
-- no dataset real nem contam para o tempo de espera entre recomendações.
alter table recommendations
  add column features       jsonb,
  add column probabilities  jsonb,
  add column trigger        text check (trigger in ('check', 'manual', 'simulation')),
  add column simulated      boolean not null default false,
  add column model_version  text,
  add column responded_at   timestamptz;

create index recommendations_trip_lookup_idx on recommendations (trip_event_id, created_at);
