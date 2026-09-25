/**
 * Um ponto a X metros do início de uma rota.
 *
 * Função pura: recebe os pontos, a tabela de distâncias acumuladas e quanto já
 * se andou, e devolve onde isso cai (interpolando dentro do segmento, para o
 * movimento ser contínuo).
 */

import { calculateHeading } from '@/features/map/utils/geo';
import type { Coordinate } from '@/features/map/types/coordinate';

export type RoutePoint = {
  coordinate: Coordinate;
  /** Direção do segmento em que o ponto caiu, em graus. */
  heading: number | null;
  /** Metros efetivamente usados (nunca além do fim da rota). */
  traveledMeters: number;
};

export function pointAlongRoute(
  coordinates: Coordinate[],
  cumulative: number[],
  meters: number,
): RoutePoint | null {
  if (coordinates.length === 0) {
    return null;
  }

  if (coordinates.length === 1) {
    return { coordinate: coordinates[0], heading: null, traveledMeters: 0 };
  }

  const total = cumulative[cumulative.length - 1] ?? 0;
  const target = Math.min(Math.max(meters, 0), total);

  // O primeiro ponto cuja distância acumulada alcança o alvo fecha o segmento.
  let index = 1;
  while (index < cumulative.length - 1 && cumulative[index] < target) {
    index += 1;
  }

  const start = coordinates[index - 1];
  const end = coordinates[index];
  const segmentMeters = cumulative[index] - cumulative[index - 1];
  const t = segmentMeters > 0 ? (target - cumulative[index - 1]) / segmentMeters : 0;

  return {
    coordinate: {
      latitude: start.latitude + (end.latitude - start.latitude) * t,
      longitude: start.longitude + (end.longitude - start.longitude) * t,
    },
    // Os pontos da rota ficam muito próximos: sem este 0, o mínimo de 5 m daria `null` quase sempre.
    heading: calculateHeading(start, end, 0),
    traveledMeters: target,
  };
}
