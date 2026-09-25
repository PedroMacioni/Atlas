import type { Coordinate } from '../types/coordinate';
import { haversineDistance } from './geo';

export type RouteProgressResult = {
  /** Índice do ponto mais próximo na rota */
  index: number;
  /** Distância em metros do usuário até a rota */
  distance: number;
};

/**
 * Encontra o ponto mais próximo na rota em relação à posição do usuário.
 * Considera tanto os vértices quanto a projeção nos segmentos.
 */
export function findNearestPointOnRoute(
  userPos: Coordinate,
  route: Coordinate[]
): RouteProgressResult {
  if (route.length === 0) {
    return { index: -1, distance: Infinity };
  }

  let nearestIndex = 0;
  let minDistance = Infinity;

  // Verifica distância para cada vértice
  for (let i = 0; i < route.length; i++) {
    const distance = haversineDistance(userPos, route[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
    }
  }

  // Verifica distância perpendicular aos segmentos
  for (let i = 0; i < route.length - 1; i++) {
    const segmentDistance = distanceToSegment(userPos, route[i], route[i + 1]);
    if (segmentDistance < minDistance) {
      minDistance = segmentDistance;
      nearestIndex = i;
    }
  }

  return { index: nearestIndex, distance: minDistance };
}

/**
 * Calcula a distância de um ponto a um segmento de reta.
 */
function distanceToSegment(point: Coordinate, segStart: Coordinate, segEnd: Coordinate): number {
  const dx = segEnd.longitude - segStart.longitude;
  const dy = segEnd.latitude - segStart.latitude;

  if (dx === 0 && dy === 0) {
    return haversineDistance(point, segStart);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.longitude - segStart.longitude) * dx + (point.latitude - segStart.latitude) * dy) /
        (dx * dx + dy * dy)
    )
  );

  const closest: Coordinate = {
    latitude: segStart.latitude + t * dy,
    longitude: segStart.longitude + t * dx,
  };

  return haversineDistance(point, closest);
}
