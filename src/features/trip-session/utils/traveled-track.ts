/**
 * O trajeto de fato percorrido, montado leitura a leitura do GPS.
 *
 * É diferente da rota planejada: é o que o resumo final desenha como "mapa do
 * trajeto percorrido" e de onde sai a "distância total" (§7.2). Função pura —
 * recebe o acumulado e uma leitura, devolve o acumulado novo.
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
 * Leituras com incerteza acima disto não entram: um ponto que pode estar a
 * 200 m de onde o carro está somaria um zigue-zague fantasma à distância.
 */
const MAX_ACCURACY_METERS = 50;

/**
 * Deslocamento mínimo para contar. O rastreamento já pede leituras a cada
 * 10 m, mas o GPS parado oscila alguns metros — somar isso inflaria a
 * distância de quem ficou meia hora num posto.
 */
const MIN_STEP_METERS = 8;

/**
 * Teto de pontos guardados, o mesmo que o backend aceita. Ao atingi-lo, a
 * trilha é rarefeita pela metade: perde resolução, nunca o começo nem o fim.
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
