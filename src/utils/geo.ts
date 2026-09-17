/**
 * Geometria sobre coordenadas geográficas.
 *
 * Funções puras, sem React, sem rede e sem domínio — só matemática sobre
 * pares de latitude e longitude. É onde vive o cálculo que responde "quanto
 * falta" enquanto a viagem acontece.
 */

import type { Coordinate } from '@/features/map/types/coordinate';

/** Raio médio da Terra, em metros (WGS 84). */
const EARTH_RADIUS_METERS = 6_371_008.8;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Distância em metros entre dois pontos, pela fórmula de Haversine.
 *
 * Considera a curvatura da Terra, e por isso continua correta em trajetos
 * longos — ao contrário de tratar graus como plano cartesiano, que erra mais
 * conforme se afasta do equador.
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
   * Posição da projeção ao longo do segmento, de 0 (início) a 1 (fim).
   *
   * Fica preso nesse intervalo de propósito: quando o ponto está "além" do
   * segmento, a projeção é a extremidade dele, não um ponto imaginário na
   * reta prolongada.
   */
  t: number;
};

/**
 * Projeta um ponto sobre o segmento entre `start` e `end`.
 *
 * Em segmentos curtos — os de uma rota são de dezenas de metros — tratar
 * graus como plano é preciso o suficiente, desde que a longitude seja
 * corrigida pelo cosseno da latitude. Sem essa correção, um grau de longitude
 * seria contado como um grau de latitude, e no sul do Brasil isso infla a
 * distância leste-oeste em cerca de 8%.
 */
export function projectOnSegment(
  point: Coordinate,
  start: Coordinate,
  end: Coordinate,
): SegmentProjection {
  // Fator de compressão da longitude na latitude de trabalho.
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

  // Segmento degenerado (dois vértices coincidentes): a projeção é o início.
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
 * Distância acumulada até cada vértice de uma linha.
 *
 * O primeiro valor é sempre 0, e o último é o comprimento total. Calcular
 * isso uma vez por rota — e não a cada leitura do GPS — é o que mantém o
 * acompanhamento barato: com a tabela pronta, saber quanto já foi percorrido
 * é uma soma, não um percurso da geometria inteira.
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
