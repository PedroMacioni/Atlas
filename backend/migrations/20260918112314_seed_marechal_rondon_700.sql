-- Av. Marechal Rondon, 700 — Jardim Chapadão, Campinas.
--
-- O endereço chegou como "Rua", mas o CEP 13070-173 é da **Avenida** Marechal
-- Rondon (ViaCEP: "até 1470 - lado par", Jardim Chapadão). Buscar "Rua
-- Marechal Rondon" no OpenStreetMap devolve outra via, em Hortolândia.
--
-- O OSM não tem o número 700 marcado nessa avenida. A coordenada veio do
-- geocodificador da Esri como ponto de endereço (PointAddress, score 97,9),
-- e foi conferida por geocodificação reversa no OSM: cai na Av. Marechal
-- Rondon, Jardim Chapadão, Campinas.
--
-- `priority` 50: salvo e recorrente, abaixo da Faculdade Anhanguera (100).
insert into places (id, name, address, category, saved, priority, latitude, longitude) values
  (
    'marechal-rondon-700',
    'Marechal Rondon, 700',
    'Av. Mal. Rondon, 700 — Jardim Chapadão, Campinas, SP',
    'saved',
    true,
    50,
    -22.893743,
    -47.088332
  )
on conflict (id) do update set
  name      = excluded.name,
  address   = excluded.address,
  category  = excluded.category,
  saved     = excluded.saved,
  priority  = excluded.priority,
  latitude  = excluded.latitude,
  longitude = excluded.longitude;
