import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  /** Quanto o carro simulado já andou na rota, em metros. */
  traveledMeters: number;
  isPaused: boolean;
  togglePause: () => void;
  /**
   * O trajeto inteiro, do começo ao destino, como se a viagem tivesse ido até
   * o fim (usado pelo botão de concluir). Junta os trechos anteriores a cada
   * desvio com o trajeto atual.
   */
  completeTrip: () => { path: Coordinate[]; distanceMeters: number; durationSeconds: number };
};

/**
 * Onde o carro está, em que rota, e quando chegou ali.
 *
 * Guardamos a rota (que só muda quando há trajeto novo), e não a geometria
 * calculada a partir dela; comparar a geometria poderia causar um loop de
 * renderização.
 */
type DemoProgress = {
  route: RouteResult;
  meters: number;
  timestamp: number;
  /** Trechos anteriores, já percorridos até o ponto de cada desvio. */
  traveled: Coordinate[];
};

/**
 * O carro da demonstração.
 *
 * Quando a rota chega, o carro aparece na metade dela e anda a 100 km/h. A
 * tela de viagem recebe uma posição igual à do GPS (com direção e
 * velocidade), então tudo funciona como numa viagem real.
 *
 * Ao aceitar uma parada, a rota muda. O carro é "reposicionado" na rota
 * nova (no ponto mais perto de onde estava), senão ele pularia de lugar.
 */
export function useDemoDrive(enabled: boolean, route: RouteResult | null): DemoDrive {
  const geometry = useMemo(
    () => (route && route.coordinates.length > 0 ? buildRouteGeometry(route.coordinates) : null),
    [route],
  );

  const [progress, setProgress] = useState<DemoProgress | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const lastTickAt = useRef<number | null>(null);

  // Largada e reposicionamento acontecem na renderização em que a rota muda.
  if (enabled && route && geometry && geometry.totalMeters > 0 && progress?.route !== route) {
    setProgress({
      route,
      meters: remapMeters(progress, geometry),
      // A hora fica em zero até o primeiro avanço (não dá para ler o relógio na renderização).
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

    lastTickAt.current = Date.now();

    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsedMs = Math.min(now - (lastTickAt.current ?? now), 250);
      lastTickAt.current = now;
      setProgress((current) =>
        current
          ? {
              ...current,
              meters: Math.min(current.route.distanceMeters, current.meters + DEMO_SPEED_METERS_PER_SECOND * elapsedMs / 1_000),
              timestamp: now,
            }
          : current,
      );
    }, DEMO_TICK_MS);

    return () => {
      clearInterval(intervalId);
      lastTickAt.current = null;
    };
  }, [enabled, isPaused, hasStarted, totalMeters]);

  const togglePause = useCallback(() => setIsPaused((paused) => !paused), []);

  /*
    A posição precisa ser o MESMO objeto enquanto nada muda: a viagem soma o
    trajeto comparando leituras por identidade, e um objeto novo a cada render
    faria ela somar para sempre.
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
    const distanceMeters = path.length > 1 ? buildRouteGeometry(path).totalMeters : 0;

    return {
      path,
      distanceMeters,
      durationSeconds: Math.round(distanceMeters / DEMO_SPEED_METERS_PER_SECOND),
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

/** Os pontos da rota atual que o carro já passou. */
function walkedPoints(progress: DemoProgress): Coordinate[] {
  const geometry = buildRouteGeometry(progress.route.coordinates);
  const last = geometry.cumulative.findIndex((meters) => meters > progress.meters);

  return progress.route.coordinates.slice(0, last === -1 ? undefined : last);
}

/**
 * Onde o carro cai numa rota nova. Sem rota anterior: metade do caminho.
 * Com rota anterior: o ponto da nova rota mais perto de onde o carro está.
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
    // A duração não importa aqui; só a distância até a projeção.
    totalDurationSeconds: 0,
    position: point.coordinate,
  });

  return onNewRoute?.traveledMeters ?? 0;
}
