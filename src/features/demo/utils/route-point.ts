/**
 * Um ponto a tantos metros do início de uma rota.
 *
 * Função pura sobre a geometria: recebe os vértices, a tabela de distâncias
 * acumuladas e quanto já se andou, e devolve onde isso cai — interpolando
 * dentro do segmento, para que o avanço seja contínuo em vez de saltar de
 * vértice em vértice.
 */

import { calculateHeading } from '@/features/map/utils/geo';
import type { Coordinate } from '@/features/map/types/coordinate';

export type RoutePoint = {
  coordinate: Coordinate;
  /** Direção do segmento em que o ponto caiu, em graus. */
  heading: number | null;
  /** Metros efetivamente usados: nunca além do fim da rota. */
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

  // O primeiro vértice cuja distância acumulada alcança o alvo fecha o
  // segmento onde o ponto está.
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
    // Vértices de rota costumam estar a poucos metros um do outro: o mínimo
    // padrão de 5 m devolveria `null` na maior parte dos segmentos.
    heading: calculateHeading(start, end, 0),
    traveledMeters: target,
  };
}
