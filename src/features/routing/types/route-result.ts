import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Resultado normalizado de um cálculo de rota.
 *
 * Este é o único formato que a camada de UI conhece. Qualquer provider
 * (OSRM, Google Routes, Mapbox Directions) deve converter sua resposta
 * para este tipo.
 */
export type RouteResult = {
  /** Geometria da rota, já em latitude/longitude, pronta para a Polyline. */
  coordinates: Coordinate[];
  /** Distância total do trajeto, em metros. */
  distanceMeters: number;
  /** Duração estimada do trajeto, em segundos. */
  durationSeconds: number;
};
