import { useMemo, useState } from 'react';

import type { Coordinate } from '@/features/map/types/coordinate';
import type { RouteResult } from '@/features/routing/types/route-result';
import {
  buildRouteGeometry,
  computeTripProgress,
  type RouteGeometry,
  type TripProgress,
} from '@/features/trip/utils/trip-progress';

/** O último cálculo, junto com o que foi usado para calculá-lo. */
type Snapshot = {
  geometry: RouteGeometry | null;
  position: Coordinate | null;
  progress: TripProgress | null;
  /** Vértice alcançado, ponto de partida da próxima busca. */
  index: number;
};

const EMPTY: Snapshot = { geometry: null, position: null, progress: null, index: 0 };

/**
 * Progresso da viagem na rota, recalculado a cada leitura de posição.
 *
 * O hook guarda a tabela de distâncias da rota, lembra até onde a busca
 * chegou e chama a função pura `computeTripProgress` (em `trip-progress.ts`).
 *
 * Devolve `null` sem rota ou sem posição (a tela mostra os totais da rota).
 */
export function useTripProgress(
  route: RouteResult | null,
  position: Coordinate | null,
): TripProgress | null {
  // A tabela de distâncias só depende da rota, então é calculada uma vez por rota.
  const geometry = useMemo(
    () => (route ? buildRouteGeometry(route.coordinates) : null),
    [route],
  );

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);

  // Mesma rota e mesma posição: reaproveita o resultado.
  if (snapshot.geometry === geometry && snapshot.position === position) {
    return snapshot.progress;
  }

  // Rota nova: a busca recomeça do primeiro ponto.
  const fromIndex = snapshot.geometry === geometry ? snapshot.index : 0;

  const progress =
    geometry && route && position
      ? computeTripProgress({
          geometry,
          totalDurationSeconds: route.durationSeconds,
          position,
          fromIndex,
        })
      : null;

  setSnapshot({
    geometry,
    position,
    progress,
    // Uma posição fora da rota não avança o ponto de partida da próxima busca.
    index: progress && !progress.isOffRoute ? progress.nearestIndex : fromIndex,
  });

  return progress;
}
