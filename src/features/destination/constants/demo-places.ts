import type { Place } from '@/features/destination/types/place';

/**
 * Lugares de demonstração, com coordenadas reais.
 *
 * Substituem o Google Places nesta fase. São suficientes para exercitar a
 * busca, os filtros e o cálculo de rota de ponta a ponta — quem escolher um
 * destino aqui recebe uma rota verdadeira, não um valor simulado.
 *
 * Quando o Places entrar, esta constante vira o resultado vazio inicial e a
 * lista passa a vir da API; a tela não muda.
 *
 * A ordem do array é a ordem exibida — `filterPlaces` preserva a sequência
 * original. No banco o mesmo papel cabe à coluna `priority`, porque lá as
 * linhas não têm ordem própria.
 */
export const DEMO_PLACES: Place[] = [
  {
    /**
     * Destino recorrente, e por isso o primeiro da lista.
     *
     * A coordenada foi conferida em duas fontes: o OpenStreetMap mapeia o
     * campus pelo acesso da Rodovia Miguel Noel Nascentes Burnier, e o ViaCEP
     * confirma que o CEP 13087-018 — o mesmo que o OSM devolve — é a Rua Luiz
     * Otávio, no Parque Taquaral.
     */
    id: 'anhanguera-taquaral',
    name: 'Faculdade Anhanguera',
    address: 'R. Luiz Otávio, 1313 — Taquaral, Campinas, SP',
    category: 'saved',
    saved: true,
    latitude: -22.8616224,
    longitude: -47.0451977,
  },
  {
    /**
     * Avenida, e não rua: o CEP 13070-173 é da Av. Marechal Rondon. A
     * coordenada é o ponto de endereço da Esri, conferido por geocodificação
     * reversa no OpenStreetMap — o OSM não tem o número 700 marcado.
     */
    id: 'marechal-rondon-700',
    name: 'Marechal Rondon, 700',
    address: 'Av. Mal. Rondon, 700 — Jardim Chapadão, Campinas, SP',
    category: 'saved',
    saved: true,
    latitude: -22.893743,
    longitude: -47.088332,
  },
  {
    id: 'viracopos',
    name: 'Aeroporto de Viracopos',
    address: 'Campinas, SP',
    category: 'saved',
    saved: true,
    latitude: -23.0074,
    longitude: -47.1345,
  },
  {
    id: 'ibirapuera',
    name: 'Parque Ibirapuera',
    address: 'São Paulo, SP',
    category: 'saved',
    saved: true,
    latitude: -23.5874,
    longitude: -46.6576,
  },
  {
    id: 'iguatemi',
    name: 'Shopping Iguatemi',
    address: 'Av. Brigadeiro Faria Lima — São Paulo, SP',
    category: 'parking',
    latitude: -23.5771,
    longitude: -46.6892,
  },
  {
    id: 'tiete',
    name: 'Terminal Rodoviário Tietê',
    address: 'Santana — São Paulo, SP',
    category: 'parking',
    latitude: -23.515,
    longitude: -46.6256,
  },
  {
    id: 'graal-oasis',
    name: 'Graal Oásis',
    address: 'Rod. dos Bandeirantes — Jundiaí, SP',
    category: 'fuel',
    latitude: -23.181,
    longitude: -46.9243,
  },
  {
    id: 'posto-anhanguera',
    name: 'Posto Anhanguera',
    address: 'Rod. Anhanguera — Campinas, SP',
    category: 'fuel',
    latitude: -22.9519,
    longitude: -47.0616,
  },
  {
    id: 'mercado-municipal',
    name: 'Mercado Municipal',
    address: 'Centro — São Paulo, SP',
    category: 'food',
    latitude: -23.5417,
    longitude: -46.6295,
  },
  {
    id: 'rua-oscar-freire',
    name: 'Restaurantes da Oscar Freire',
    address: 'Jardins — São Paulo, SP',
    category: 'food',
    latitude: -23.5629,
    longitude: -46.6702,
  },
];
