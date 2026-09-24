import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEMO_SPEED_METERS_PER_SECOND,
  DEMO_START_FRACTION,
  DEMO_TICK_MS,
} from '@/features/demo/constants/demo-drive';
import { pointAlongRoute } from '@/features/demo/utils/route-point';
import type { TrackedPosition } from '@/features/location/services/location-tracking-service';
import type { Coordinate } from '@/features/map/types/coordinate';
import type { RouteResult } from '@/features/routing/types/route-result';
import {
  buildRouteGeometry,
  computeTripProgress,
  type RouteGeometry,
} from '@/features/trip/utils/trip-progress';

export type DemoDrive = {
  /** A posição que a tela usa no lugar do GPS, ou `null` sem rota ainda. */
  position: TrackedPosition | null;
  /** Quanto o carro simulado já andou sobre a rota, em metros. */
  traveledMeters: number;
  isPaused: boolean;
  togglePause: () => void;
  /**
   * O trajeto inteiro, do começo ao destino, como se a viagem tivesse sido
   * feita até o fim — é o que o botão de concluir manda para o resumo.
   *
   * Junta o que já foi andado nos trajetos anteriores (antes de cada desvio)
   * com o trajeto atual completo, e por isso continua sendo o caminho de
   * verdade mesmo depois de uma parada aceita.
   */
  completeTrip: () => { path: Coordinate[]; distanceMeters: number; durationSeconds: number };
};

/**
 * Onde o carro está, em que trajeto, e quando ele chegou aí.
 *
 * O trajeto é guardado como a **rota**, e não como a geometria derivada dela.
 * A distinção importa: a rota vem de fora e só muda quando há trajeto novo,
 * enquanto a geometria é um valor memoizado — e comparar identidade de valor
 * memoizado para decidir se atualiza o estado é o caminho curto para um laço
 * de renderização, porque basta a memoização ser descartada uma vez para a
 * comparação dar "mudou" para sempre.
 */
type DemoProgress = {
  route: RouteResult;
  meters: number;
  timestamp: number;
  /** Os trajetos anteriores, já percorridos até o ponto de cada desvio. */
  traveled: Coordinate[];
};

/**
 * O carro da demonstração.
 *
 * Assim que a rota chega, o ponto aparece na metade dela — é o "estou no meio
 * do caminho" — e passa a andar a 100 km/h enquanto a tela estiver aberta. A
 * tela de viagem não sabe que a posição é inventada: recebe uma
 * `TrackedPosition` igual à do GPS, com direção e velocidade, e o
 * acompanhamento, o progresso e as manobras funcionam como sempre.
 *
 * Aceitar uma parada troca o trajeto por outro, que começa onde o carro está
 * e passa pelo posto. Os metros percorridos não valem nada nessa rota nova —
 * são a conta de um trajeto que começava 58 km atrás —, e por isso o carro é
 * **reprojetado**: sua posição no mundo é procurada na geometria nova, e a
 * contagem recomeça dali. Sem isso ele saltaria para perto do destino.
 */
export function useDemoDrive(enabled: boolean, route: RouteResult | null): DemoDrive {
  const geometry = useMemo(
    () => (route && route.coordinates.length > 0 ? buildRouteGeometry(route.coordinates) : null),
    [route],
  );

  const [progress, setProgress] = useState<DemoProgress | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Largada e reprojeção acontecem na renderização em que a rota muda — o
  // mesmo padrão de derivar estado que `use-trip-origin` usa, e não um efeito,
  // que deixaria um quadro com o carro no lugar errado.
  if (enabled && route && geometry && geometry.totalMeters > 0 && progress?.route !== route) {
    setProgress({
      route,
      meters: remapMeters(progress, geometry),
      // O instante fica em zero até o primeiro avanço: ninguém lê a hora da
      // leitura, e o relógio não pode ser consultado durante a renderização.
      timestamp: progress?.timestamp ?? 0,
      traveled: progress ? [...progress.traveled, ...walkedPoints(progress)] : [],
    });
  }

  const totalMeters = geometry?.totalMeters ?? 0;
  const hasStarted = progress !== null;

  useEffect(() => {
    if (!enabled || isPaused || !hasStarted || totalMeters <= 0) {
      return;
    }

    const step = (DEMO_SPEED_METERS_PER_SECOND * DEMO_TICK_MS) / 1_000;

    const intervalId = setInterval(() => {
      setProgress((current) =>
        current
          ? {
              ...current,
              meters: Math.min(current.route.distanceMeters, current.meters + step),
              timestamp: Date.now(),
            }
          : current,
      );
    }, DEMO_TICK_MS);

    return () => clearInterval(intervalId);
  }, [enabled, isPaused, hasStarted, totalMeters]);

  const togglePause = useCallback(() => setIsPaused((paused) => !paused), []);

  /*
    A posição precisa ser o *mesmo objeto* enquanto nada muda: a viagem soma o
    trajeto percorrido comparando a leitura atual com a última já somada, por
    identidade. Um objeto novo a cada renderização a faria somar para sempre.
  */
  const position = useMemo<TrackedPosition | null>(() => {
    if (!enabled || !geometry || !progress || progress.route !== route) {
      return null;
    }

    const point = pointAlongRoute(geometry.coordinates, geometry.cumulative, progress.meters);

    if (!point) {
      return null;
    }

    return {
      coordinate: point.coordinate,
      speed: isPaused ? 0 : DEMO_SPEED_METERS_PER_SECOND,
      heading: point.heading,
      accuracy: 5,
      timestamp: progress.timestamp,
    };
  }, [enabled, route, geometry, progress, isPaused]);

  const completeTrip = useCallback(() => {
    const path = progress ? [...progress.traveled, ...progress.route.coordinates] : [];

    return {
      path,
      distanceMeters: path.length > 1 ? buildRouteGeometry(path).totalMeters : 0,
      durationSeconds: progress?.route.durationSeconds ?? 0,
    };
  }, [progress]);

  return {
    position,
    traveledMeters: position?.coordinate ? Math.min(progress?.meters ?? 0, totalMeters) : 0,
    isPaused,
    togglePause,
    completeTrip,
  };
}

/** Os vértices do trajeto atual que o carro já deixou para trás. */
function walkedPoints(progress: DemoProgress): Coordinate[] {
  const geometry = buildRouteGeometry(progress.route.coordinates);
  const last = geometry.cumulative.findIndex((meters) => meters > progress.meters);

  return progress.route.coordinates.slice(0, last === -1 ? undefined : last);
}

/**
 * Onde o carro cai numa geometria nova.
 *
 * Sem trajeto anterior é a largada: metade do caminho. Com um, é o ponto da
 * rota nova mais próximo de onde o carro está agora — a mesma projeção que o
 * acompanhamento da viagem faz com a leitura do GPS.
 */
function remapMeters(previous: DemoProgress | null, geometry: RouteGeometry): number {
  if (!previous) {
    return geometry.totalMeters * DEMO_START_FRACTION;
  }

  const before = buildRouteGeometry(previous.route.coordinates);
  const point = pointAlongRoute(before.coordinates, before.cumulative, previous.meters);

  if (!point) {
    return 0;
  }

  const onNewRoute = computeTripProgress({
    geometry,
    // A duração não importa aqui: só se quer a distância até a projeção.
    totalDurationSeconds: 0,
    position: point.coordinate,
  });

  return onNewRoute?.traveledMeters ?? 0;
}
