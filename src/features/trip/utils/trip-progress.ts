/**
 * Progresso da viagem: onde o usuário está na rota e quanto falta.
 *
 * Função pura: recebe a rota e a posição e devolve números (fácil de testar).
 */

import type { Coordinate } from '@/features/map/types/coordinate';
import { calculateHeading } from '@/features/map/utils/geo';
import { buildCumulativeDistances, distanceBetween, projectOnSegment } from '@/utils/geo';

/** Tabela de distâncias da rota, calculada uma vez e usada em cada leitura do GPS. */
export type RouteGeometry = {
  coordinates: Coordinate[];
  /** Distância acumulada até cada vértice. */
  cumulative: number[];
  /** Comprimento total, medido sobre a geometria. */
  totalMeters: number;
};

export function buildRouteGeometry(coordinates: Coordinate[]): RouteGeometry {
  const cumulative = buildCumulativeDistances(coordinates);

  return {
    coordinates,
    cumulative,
    totalMeters: cumulative[cumulative.length - 1] ?? 0,
  };
}

export type TripProgress = {
  /** Distância já percorrida sobre a rota, em metros. */
  traveledMeters: number;
  /** Distância que falta até o destino, em metros. */
  remainingMeters: number;
  /** Estimativa do tempo restante, em segundos. */
  remainingSeconds: number;
  /** Fração concluída, de 0 a 1 — o que a barra de progresso desenha. */
  fraction: number;
  /** Ponto da rota mais próximo da posição atual. */
  snappedPoint: Coordinate;
  /** Índice do ponto onde a busca parou, para continuar dali na próxima. */
  nearestIndex: number;
  /**
   * Direção da rua (em graus) no ponto da rota onde o usuário está, e não a do
   * celular. Faz a seta apontar para onde a rua segue; o rumo do GPS oscila com
   * o carro parado.
   */
  courseDegrees: number | null;
  /** Distância entre a posição real e a rota, em metros. */
  offRouteMeters: number;
  /** `true` quando o usuário está longe demais da rota. */
  isOffRoute: boolean;
  /** `true` quando o destino está a poucos metros. */
  hasArrived: boolean;
};

/**
 * A partir desta distância consideramos que o usuário saiu da rota. 60 m
 * absorve erro de GPS, viadutos e ruas paralelas.
 */
const OFF_ROUTE_THRESHOLD_METERS = 60;

/** A esta distância do destino a viagem é considerada concluída. */
const ARRIVAL_THRESHOLD_METERS = 40;

/**
 * Quantos pontos à frente a busca olha antes de procurar na rota inteira.
 *
 * A busca começa no último ponto alcançado e vai para frente, porque o
 * progresso não volta. Isso resolve rotas que passam duas vezes pelo mesmo
 * lugar (ida e volta na mesma avenida): uma busca na rota toda poderia achar
 * o trecho errado.
 */
const FORWARD_WINDOW = 400;

export type ComputeTripProgressParams = {
  geometry: RouteGeometry;
  /** Duração total estimada pelo serviço de rotas, em segundos. */
  totalDurationSeconds: number;
  /** Posição atual do usuário. */
  position: Coordinate;
  /** Índice alcançado na leitura anterior. Começa em 0. */
  fromIndex?: number;
};

export function computeTripProgress({
  geometry,
  totalDurationSeconds,
  position,
  fromIndex = 0,
}: ComputeTripProgressParams): TripProgress | null {
  const { coordinates, cumulative, totalMeters } = geometry;

  if (coordinates.length < 2 || totalMeters <= 0) {
    return null;
  }

  const start = Math.min(Math.max(fromIndex, 0), coordinates.length - 2);

  let best = findNearestSegment(position, geometry, start, start + FORWARD_WINDOW);

  // Longe da janela à frente (atalho, desvio ou sem sinal)? Procura na rota inteira.
  if (best.distanceMeters > OFF_ROUTE_THRESHOLD_METERS) {
    const global = findNearestSegment(position, geometry, 0, coordinates.length - 2);

    if (global.distanceMeters < best.distanceMeters) {
      best = global;
    }
  }

  const traveledMeters = Math.min(
    totalMeters,
    cumulative[best.index] +
      best.t * (cumulative[best.index + 1] - cumulative[best.index]),
  );

  const remainingMeters = Math.max(0, totalMeters - traveledMeters);
  const fraction = Math.min(1, Math.max(0, traveledMeters / totalMeters));

  // Tempo restante proporcional à distância restante. É uma estimativa simples:
  // o serviço de rotas deu uma duração para o trajeto todo, sem trânsito.
  const remainingSeconds = totalDurationSeconds * (1 - fraction);

  const destination = coordinates[coordinates.length - 1];

  return {
    traveledMeters,
    remainingMeters,
    remainingSeconds,
    fraction,
    snappedPoint: best.point,
    nearestIndex: best.index,
    // Os pontos da rota ficam muito próximos: sem este 0, o mínimo de 5 m ignoraria a maioria.
    courseDegrees: calculateHeading(coordinates[best.index], coordinates[best.index + 1], 0),
    offRouteMeters: best.distanceMeters,
    isOffRoute: best.distanceMeters > OFF_ROUTE_THRESHOLD_METERS,
    hasArrived: distanceBetween(position, destination) <= ARRIVAL_THRESHOLD_METERS,
  };
}

type NearestSegment = {
  index: number;
  t: number;
  point: Coordinate;
  distanceMeters: number;
};

/** Procura, num intervalo de segmentos, o mais próximo da posição. */
function findNearestSegment(
  position: Coordinate,
  geometry: RouteGeometry,
  from: number,
  to: number,
): NearestSegment {
  const { coordinates } = geometry;
  const last = Math.min(to, coordinates.length - 2);

  let best: NearestSegment = {
    index: from,
    t: 0,
    point: coordinates[from],
    distanceMeters: Number.POSITIVE_INFINITY,
  };

  for (let index = from; index <= last; index += 1) {
    const projection = projectOnSegment(position, coordinates[index], coordinates[index + 1]);

    if (projection.distanceMeters < best.distanceMeters) {
      best = {
        index,
        t: projection.t,
        point: projection.point,
        distanceMeters: projection.distanceMeters,
      };
    }
  }

  return best;
}
