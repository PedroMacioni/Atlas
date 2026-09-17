/**
 * Progresso da viagem: onde o usuário está na rota, e quanto falta.
 *
 * Função pura sobre a geometria e uma posição. Não sabe de React, de GPS nem
 * de mapa — recebe pontos e devolve números, o que a torna testável sem
 * simulador e sem sair do lugar.
 */

import type { Coordinate } from '@/features/map/types/coordinate';
import { buildCumulativeDistances, distanceBetween, projectOnSegment } from '@/utils/geo';

/**
 * Tabela de distâncias de uma rota, calculada uma vez e reaproveitada em cada
 * leitura do GPS.
 */
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
  /** Índice do vértice onde a busca parou, para continuar dali na próxima. */
  nearestIndex: number;
  /** Distância entre a posição real e a rota, em metros. */
  offRouteMeters: number;
  /** `true` quando o usuário está longe o bastante para o progresso não valer. */
  isOffRoute: boolean;
  /** `true` quando o destino está a poucos metros. */
  hasArrived: boolean;
};

/**
 * A partir desta distância da rota, consideramos que o usuário saiu dela.
 *
 * Generoso de propósito: 60 m absorve imprecisão de GPS em cidade, viadutos e
 * vias marginais paralelas à principal, sem declarar desvio a cada oscilação.
 */
const OFF_ROUTE_THRESHOLD_METERS = 60;

/** Distância do destino a partir da qual a viagem é considerada concluída. */
const ARRIVAL_THRESHOLD_METERS = 40;

/**
 * Quantos vértices à frente a busca olha antes de desistir e varrer a rota
 * inteira.
 *
 * A busca começa no último vértice alcançado e caminha para frente, porque o
 * progresso não retrocede. Isso resolve o caso em que a rota passa duas vezes
 * pelo mesmo lugar — ida e volta na mesma avenida, um retorno, um trecho que
 * se cruza: uma busca global casaria a posição com o trecho errado e o tempo
 * restante saltaria para trás.
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

  // Longe da janela à frente? Pode ter havido um atalho, um desvio, ou o
  // aparelho ficou sem sinal por um trecho. Vale varrer tudo antes de
  // declarar que saiu da rota.
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

  // O tempo restante é proporcional à distância restante. É uma estimativa
  // honesta e não uma previsão: o serviço de rotas entregou uma duração para o
  // trajeto inteiro, sem trânsito, e não há dado novo para refiná-la. A
  // previsão de verdade é a fase do modelo de histórico.
  const remainingSeconds = totalDurationSeconds * (1 - fraction);

  const destination = coordinates[coordinates.length - 1];

  return {
    traveledMeters,
    remainingMeters,
    remainingSeconds,
    fraction,
    snappedPoint: best.point,
    nearestIndex: best.index,
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

/** Varre uma faixa de segmentos e devolve o mais próximo da posição. */
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
