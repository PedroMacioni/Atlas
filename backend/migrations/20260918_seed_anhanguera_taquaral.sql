-- Faculdade Anhanguera — Taquaral, Campinas.
--
-- Endereço postal: R. Luiz Otávio, 1313 - Bl A - Parque Taquaral,
-- Campinas - SP, 13087-018.
--
-- A coordenada foi conferida por duas fontes independentes, porque o
-- logradouro divergia: o OpenStreetMap mapeia o campus como "Anhanguera
-- FAC 3", nº 1313, com acesso pela Rodovia Miguel Noel Nascentes Burnier —
-- mas com o **mesmo CEP 13087-018**, que o ViaCEP confirma ser a Rua Luiz
-- Otávio, no Parque Taquaral. O número e o CEP batem nas duas; o que difere é
-- por qual via o OSM registrou a entrada.
--
-- `priority` alto porque é destino recorrente: fica no topo da lista, acima
-- do aeroporto, que a ordem alfabética colocaria antes.
insert into places (id, name, address, category, saved, priority, latitude, longitude) values
  (
    'anhanguera-taquaral',
    'Faculdade Anhanguera',
    'R. Luiz Otávio, 1313 — Taquaral, Campinas, SP',
    'saved',
    true,
    100,
    -22.8616224,
    -47.0451977
  )
on conflict (id) do update set
  name      = excluded.name,
  address   = excluded.address,
  category  = excluded.category,
  saved     = excluded.saved,
  priority  = excluded.priority,
  latitude  = excluded.latitude,
  longitude = excluded.longitude;
