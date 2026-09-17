-- Os oito lugares que viviam em features/destination/constants/demo-places.ts.
-- Coordenadas reais, as mesmas — a fonte muda de arquivo para banco, o dado não.
insert into places (id, name, address, category, saved, latitude, longitude) values
  ('viracopos',         'Aeroporto de Viracopos',       'Campinas, SP',                              'saved',   true,  -23.0074, -47.1345),
  ('ibirapuera',        'Parque Ibirapuera',            'São Paulo, SP',                             'saved',   true,  -23.5874, -46.6576),
  ('iguatemi',          'Shopping Iguatemi',            'Av. Brigadeiro Faria Lima — São Paulo, SP', 'parking', false, -23.5771, -46.6892),
  ('tiete',             'Terminal Rodoviário Tietê',    'Santana — São Paulo, SP',                   'parking', false, -23.5150, -46.6256),
  ('graal-oasis',       'Graal Oásis',                  'Rod. dos Bandeirantes — Jundiaí, SP',       'fuel',    false, -23.1810, -46.9243),
  ('posto-anhanguera',  'Posto Anhanguera',             'Rod. Anhanguera — Campinas, SP',            'fuel',    false, -22.9519, -47.0616),
  ('mercado-municipal', 'Mercado Municipal',            'Centro — São Paulo, SP',                    'food',    false, -23.5417, -46.6295),
  ('rua-oscar-freire',  'Restaurantes da Oscar Freire', 'Jardins — São Paulo, SP',                   'food',    false, -23.5629, -46.6702)
on conflict (id) do nothing;
