import { distanceBetween } from '@/utils/geo';

import type { Coordinate } from '../types/coordinate';

/**
 * Distância em metros entre duas coordenadas (fórmula de Haversine).
 * Usa a mesma função de `utils/geo.ts`, para o app ter um cálculo só.
 */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  return distanceBetween(a, b);
}

/**
 * Direção (rumo) em graus de `from` para `to`: 0 = norte, 90 = leste.
 * Devolve `null` se os pontos estiverem a menos de `minDistance` metros.
 */
export function calculateHeading(
  from: Coordinate,
  to: Coordinate,
  minDistance: number = 5
): number | null {
  const distance = haversineDistance(from, to);
  if (distance < minDistance) {
    return null;
  }

  const dLng = toRadians(to.longitude - from.longitude);
  const fromLatRad = toRadians(from.latitude);
  const toLatRad = toRadians(to.latitude);

  const x = Math.sin(dLng) * Math.cos(toLatRad);
  const y =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(dLng);

  const heading = toDegrees(Math.atan2(x, y));
  return (heading + 360) % 360;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
