-- Viagens, diário de bordo e histórico (escopo §8 e §10).
--
-- Sem login: o aplicativo gera um UUID anônimo na primeira execução, guarda no
-- aparelho e o envia em toda chamada. `devices` é só a âncora desse
-- identificador; as viagens pendem dela.
--
-- O histórico é mantido por tempo indeterminado e não há exclusão pelo
-- aplicativo (RF-30): nenhuma tabela aqui recebe policy, e a API não expõe
-- DELETE. Só a chave de serviço, no backend, alcança estes dados.
--
-- Os vocabulários da IA — emoções, classes de imagem e decisões — ficam
-- fixados por CHECK. São o contrato entre o aplicativo, os modelos em Python e
-- o banco; um valor fora dele é um erro, não um dado novo.

create table devices (
  id              uuid primary key default gen_random_uuid(),
  anonymous_uuid  uuid not null unique,
  created_at      timestamptz not null default now()
);

create table trips (
  id                     uuid primary key default gen_random_uuid(),
  device_id              uuid not null references devices (id),
  origin_name            text not null,
  origin_latitude        double precision not null check (origin_latitude between -90 and 90),
  origin_longitude       double precision not null check (origin_longitude between -180 and 180),
  destination_name       text not null,
  destination_latitude   double precision not null check (destination_latitude between -90 and 90),
  destination_longitude  double precision not null check (destination_longitude between -180 and 180),
  started_at             timestamptz not null default now(),
  ended_at               timestamptz,
  -- As três formas de encerrar previstas em RF-25 / CA-13.
  end_reason             text check (end_reason in ('arrival', 'button', 'voice')),
  -- Distância realmente percorrida (GPS), não a da rota planejada.
  distance_meters        double precision check (distance_meters >= 0),
  duration_seconds       double precision check (duration_seconds >= 0),
  predominant_emotion    text check (predominant_emotion in ('cansado', 'neutro', 'animado', 'tenso', 'bravo')),
  -- Trajeto percorrido, em GeoJSON [[lon, lat], ...], para o mapa do resumo.
  path                   jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now(),
  check ((ended_at is null) = (end_reason is null))
);

-- O histórico lista as viagens de um aparelho, da mais recente para a mais antiga.
create index trips_device_started_idx on trips (device_id, started_at desc);

create table trip_events (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references trips (id),
  occurred_at         timestamptz not null default now(),
  latitude            double precision check (latitude between -90 and 90),
  longitude           double precision check (longitude between -180 and 180),
  kind                text not null check (kind in (
                        'trip_started', 'trip_ended', 'stop', 'command',
                        'recommendation', 'tourist_spot', 'emergency'
                      )),
  -- Comando reconhecido ou ação tocada: "Registrar parada", "SAMU 192"...
  command             text,
  emotion             text check (emotion in ('cansado', 'neutro', 'animado', 'tenso', 'bravo')),
  emotion_confidence  real check (emotion_confidence between 0 and 1),
  image_class         text check (image_class in ('estrada', 'posto', 'restaurante', 'ponto_turistico')),
  decision            text check (decision in (
                        'continuar', 'descansar', 'abastecer', 'alimentar',
                        'registrar_ponto_turistico', 'fazer_parada'
                      )),
  justification       text,
  created_at          timestamptz not null default now()
);

create index trip_events_trip_occurred_idx on trip_events (trip_id, occurred_at);

create table stops (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id),
  name        text not null,
  category    text,
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  position    integer not null check (position >= 1),
  reason      text,
  created_at  timestamptz not null default now(),
  unique (trip_id, position)
);

create table photos (
  id             uuid primary key default gen_random_uuid(),
  trip_event_id  uuid not null references trip_events (id),
  storage_path   text not null,
  created_at     timestamptz not null default now()
);

create index photos_event_idx on photos (trip_event_id);

create table recommendations (
  id               uuid primary key default gen_random_uuid(),
  trip_event_id    uuid not null references trip_events (id),
  decision         text not null check (decision in (
                     'continuar', 'descansar', 'abastecer', 'alimentar',
                     'registrar_ponto_turistico', 'fazer_parada'
                   )),
  confidence       real check (confidence between 0 and 1),
  -- `null` enquanto o usuário não respondeu à sugestão.
  accepted         boolean,
  suggested_place  jsonb,
  created_at       timestamptz not null default now()
);

create index recommendations_event_idx on recommendations (trip_event_id);

-- Sem policy nenhuma, de propósito: só a API, com a chave de serviço, lê e
-- escreve. Um cliente com a chave `anon` não alcança o histórico de ninguém.
alter table devices enable row level security;
alter table trips enable row level security;
alter table trip_events enable row level security;
alter table stops enable row level security;
alter table photos enable row level security;
alter table recommendations enable row level security;
