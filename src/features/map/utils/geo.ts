import type { Coordinate } from '../types/coordinate';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calcula a distância em metros entre duas coordenadas usando fórmula de Haversine
 */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calcula o heading (direção) em graus de `from` para `to`.
 * Retorna null se a distância for menor que `minDistance` metros.
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
