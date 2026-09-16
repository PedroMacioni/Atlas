import type { NamedCoordinate } from '@/features/map/types/coordinate';

/**
 * Trajeto fixo usado para validar o fluxo completo desta primeira fase.
 *
 * Substituir por busca de endereço (Google Places) em uma etapa futura;
 * nenhuma tela deve conter coordenadas literais.
 */
export const DEMO_ORIGIN: NamedCoordinate = {
  latitude: -22.9056,
  longitude: -47.0608,
  name: 'Campinas',
};

export const DEMO_DESTINATION: NamedCoordinate = {
  latitude: -23.0074,
  longitude: -47.1345,
  name: 'Aeroporto de Viracopos',
};
