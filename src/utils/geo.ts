/**
 * Cálculos com coordenadas geográficas (latitude e longitude).
 *
 * Funções puras: só matemática, sem React e sem rede.
 */

import type { Coordinate } from '@/features/map/types/coordinate';

/** Raio médio da Terra, em metros (WGS 84). */
const EARTH_RADIUS_METERS = 6_371_008.8;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Distância em metros entre dois pontos (fórmula de Haversine).
 *
 * Considera a curvatura da Terra, então funciona bem mesmo em trajetos longos.
 */
export function distanceBetween(from: Coordinate, to: Coordinate): number {
  const fromLatitude = from.latitude * DEGREES_TO_RADIANS;
  const toLatitude = to.latitude * DEGREES_TO_RADIANS;
  const deltaLatitude = toLatitude - fromLatitude;
  const deltaLongitude = (to.longitude - from.longitude) * DEGREES_TO_RADIANS;

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export type SegmentProjection = {
  /** Ponto do segmento mais próximo de `point`. */
  point: Coordinate;
  /** Distância, em metros, de `point` até o segmento. */
  distanceMeters: number;
  /**
   * Posição da projeção no segmento: 0 = início, 1 = fim.
   *
   * Fica limitada entre 0 e 1: se o ponto estiver "além" do segmento, a
   * projeção é a ponta dele.
   */
  t: number;
};

/**
 * Projeta um ponto sobre o segmento entre `start` e `end` (acha o ponto do
 * segmento mais perto dele).
 *
 * Em trechos curtos (os de uma rota têm dezenas de metros) dá para tratar
 * latitude/longitude como um plano, desde que a longitude seja corrigida pelo
 * cosseno da latitude. Sem essa correção, no sul do Brasil a distância
 * leste-oeste sairia uns 8% maior.
 */
export function projectOnSegment(
  point: Coordinate,
  start: Coordinate,
  end: Coordinate,
): SegmentProjection {
  // Quanto a longitude "encolhe" nesta latitude.
  const longitudeScale = Math.cos(point.latitude * DEGREES_TO_RADIANS);

  const startX = start.longitude * longitudeScale;
  const startY = start.latitude;
  const endX = end.longitude * longitudeScale;
  const endY = end.latitude;
  const pointX = point.longitude * longitudeScale;
  const pointY = point.latitude;

  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

  // Segmento com os dois pontos iguais: a projeção é o próprio início.
  if (segmentLengthSquared === 0) {
    return { point: start, distanceMeters: distanceBetween(point, start), t: 0 };
  }

  const rawT = ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / segmentLengthSquared;
  const t = Math.min(1, Math.max(0, rawT));

  const projected: Coordinate = {
    latitude: startY + t * segmentY,
    longitude: (startX + t * segmentX) / longitudeScale,
  };

  return { point: projected, distanceMeters: distanceBetween(point, projected), t };
}

/**
 * Distância acumulada até cada ponto de uma linha.
 *
 * O primeiro valor é 0 e o último é o comprimento total. Calculamos isso uma
 * vez por rota; depois, saber quanto já foi percorrido é só uma soma.
 */
export function buildCumulativeDistances(coordinates: Coordinate[]): number[] {
  const cumulative: number[] = new Array(coordinates.length);
  let total = 0;

  for (let index = 0; index < coordinates.length; index += 1) {
    if (index > 0) {
      total += distanceBetween(coordinates[index - 1], coordinates[index]);
    }
    cumulative[index] = total;
  }

  return cumulative;
}
