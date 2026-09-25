import { useCallback, useEffect, useState } from 'react';

import type { Coordinate } from '@/features/map/types/coordinate';
import { getRoute } from '@/features/routing/services/route-service';
import { RouteError } from '@/features/routing/types/route-provider';
import type { RouteResult } from '@/features/routing/types/route-result';

type RouteSnapshot = {
  isLoading: boolean;
  route: RouteResult | null;
  error: string | null;
};

export type RouteState = RouteSnapshot & {
  retry: () => void;
};

const PENDING: RouteSnapshot = { isLoading: true, route: null, error: null };
const GENERIC_ERROR = 'Não foi possível calcular a rota.';

/** Identifica a consulta que deve estar em andamento. */
function buildRequestKey(
  origin: Coordinate | null,
  destination: Coordinate,
  waypoints: Coordinate[],
  attempt: number,
): string {
  const from = origin ? `${origin.latitude},${origin.longitude}` : 'aguardando-origem';
  const via = waypoints.map((point) => `${point.latitude},${point.longitude}`).join(';');

  return [attempt, from, via, destination.latitude, destination.longitude].join('|');
}

const NO_WAYPOINTS: Coordinate[] = [];

/**
 * Calcula a rota e guarda o estado da consulta.
 *
 * `origin` nulo = origem ainda carregando: nada é pedido até ela chegar.
 *
 * A consulta anterior é cancelada quando a tela fecha ou quando uma nova
 * tentativa começa.
 */
export function useTripRoute(
  origin: Coordinate | null,
  destination: Coordinate,
  /** Paradas no caminho (um desvio aceito). Precisa ser a mesma lista entre renders. */
  waypoints: Coordinate[] = NO_WAYPOINTS,
): RouteState {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<RouteSnapshot>(PENDING);

  const requestKey = buildRequestKey(origin, destination, waypoints, attempt);
  const [renderedKey, setRenderedKey] = useState(requestKey);

  // Quando origem, destino ou tentativa mudam, o resultado anterior deixa de valer na hora.
  if (renderedKey !== requestKey) {
    setRenderedKey(requestKey);
    setSnapshot(PENDING);
  }

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!origin) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    getRoute({ origin, destination, waypoints, signal: controller.signal })
      .then((result) => {
        if (active) {
          setSnapshot({ isLoading: false, route: result, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setSnapshot({
            isLoading: false,
            route: null,
            error: cause instanceof RouteError ? cause.message : GENERIC_ERROR,
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestKey, origin, destination, waypoints]);

  return { ...snapshot, retry };
}
