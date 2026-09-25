/**
 * Trajeto percorrido de verdade, montado leitura por leitura do GPS.
 *
 * É diferente da rota planejada: é o que o resumo desenha como "trajeto
 * percorrido" e de onde sai a distância total (§7.2). Função pura.
 */

import type { Coordinate } from '@/features/map/types/coordinate';
import { distanceBetween } from '@/utils/geo';

export type TraveledTrack = {
  points: Coordinate[];
  distanceMeters: number;
};

export const EMPTY_TRACK: TraveledTrack = { points: [], distanceMeters: 0 };

export type TrackReading = {
  coordinate: Coordinate;
  /** Raio de incerteza, em metros, quando o aparelho informa. */
  accuracy: number | null;
};

/**
 * Leituras com incerteza maior que 50 m são ignoradas (somariam um
 * zigue-zague falso à distância).
 */
const MAX_ACCURACY_METERS = 50;

/**
 * Movimento mínimo para contar. Parado, o GPS oscila alguns metros, e somar
 * isso aumentaria a distância de quem ficou meia hora num posto.
 */
const MIN_STEP_METERS = 8;

/**
 * Máximo de pontos guardados (o mesmo limite do backend). Ao passar disso, a
 * trilha fica com metade dos pontos, mantendo o começo e o fim.
 */
export const MAX_TRACK_POINTS = 20_000;

export function appendReading(track: TraveledTrack, reading: TrackReading): TraveledTrack {
  const { coordinate, accuracy } = reading;

  if (accuracy !== null && accuracy > MAX_ACCURACY_METERS) {
    return track;
  }

  const last = track.points[track.points.length - 1];

  if (!last) {
    return { points: [coordinate], distanceMeters: 0 };
  }

  const step = distanceBetween(last, coordinate);

  if (step < MIN_STEP_METERS) {
    return track;
  }

  const points = [...track.points, coordinate];

  return {
    points: points.length > MAX_TRACK_POINTS ? thin(points) : points,
    distanceMeters: track.distanceMeters + step,
  };
}

/** Mantém um ponto a cada dois, preservando sempre o último. */
function thin(points: Coordinate[]): Coordinate[] {
  const kept = points.filter((_, index) => index % 2 === 0);
  const last = points[points.length - 1];

  return kept[kept.length - 1] === last ? kept : [...kept, last];
}
