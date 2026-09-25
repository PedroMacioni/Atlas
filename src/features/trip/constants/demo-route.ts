import type { NamedCoordinate } from '@/features/map/types/coordinate';

/** Origem e destino padrão, usados quando falta GPS ou um destino válido. */
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
