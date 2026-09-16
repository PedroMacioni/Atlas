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
 */
export const DEMO_PLACES: Place[] = [
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
