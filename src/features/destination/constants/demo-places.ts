import type { Place } from '@/features/destination/types/place';

/**
 * Lugares de exemplo, com coordenadas reais.
 *
 * São usados quando a API não está configurada (ou falha). A ordem da lista é
 * a ordem mostrada na tela.
 */
export const DEMO_PLACES: Place[] = [
  {
    /** Destino usado com frequência, por isso vem primeiro. */
    id: 'anhanguera-taquaral',
    name: 'Faculdade Anhanguera',
    address: 'R. Luiz Otávio, 1313 — Taquaral, Campinas, SP',
    category: 'saved',
    saved: true,
    latitude: -22.8616224,
    longitude: -47.0451977,
  },
  {
    /** Avenida, e não rua: o CEP 13070-173 é da Av. Marechal Rondon. */
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
