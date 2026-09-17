import { useMemo, useState } from 'react';

import type { Coordinate } from '@/features/map/types/coordinate';
import type { RouteResult } from '@/features/routing/types/route-result';
import {
  buildRouteGeometry,
  computeTripProgress,
  type RouteGeometry,
  type TripProgress,
} from '@/features/trip/utils/trip-progress';

/**
 * O último cálculo, junto com as entradas que o produziram.
 *
 * Guardar as entradas é o que permite reconhecer uma renderização em que nada
 * mudou — e devolver o resultado pronto em vez de percorrer a geometria de
 * novo.
 */
type Snapshot = {
  geometry: RouteGeometry | null;
  position: Coordinate | null;
  progress: TripProgress | null;
  /** Vértice alcançado, ponto de partida da próxima busca. */
  index: number;
};

const EMPTY: Snapshot = { geometry: null, position: null, progress: null, index: 0 };

/**
 * Progresso da viagem sobre a rota, recalculado a cada leitura de posição.
 *
 * O hook faz três coisas e nada mais: guarda a tabela de distâncias da rota
 * enquanto ela não muda, lembra até onde a busca chegou, e chama a função pura
 * de progresso. Todo o cálculo vive em `trip-progress.ts`.
 *
 * A memória do índice fica em estado, e não em um ref: com o React Compiler
 * ligado o corpo do componente pode ser reexecutado, e ler ou escrever um ref
 * durante a renderização deixa de ser seguro. Ajustar estado durante o render
 * é o padrão que o React recomenda para derivar valor de props que mudaram —
 * o mesmo que `use-trip-route` usa para invalidar a rota anterior.
 *
 * Devolve `null` quando não há rota ou não há posição — a tela mostra os
 * totais do trajeto nesse caso, e não zeros.
 */
export function useTripProgress(
  route: RouteResult | null,
  position: Coordinate | null,
): TripProgress | null {
  // A tabela de distâncias acumuladas é O(n) sobre a geometria — cara o
  // bastante para não ser refeita a cada leitura do GPS, e só depende da rota.
  const geometry = useMemo(
    () => (route ? buildRouteGeometry(route.coordinates) : null),
    [route],
  );

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);

  // Mesma rota e mesma posição: o resultado guardado ainda vale. É este atalho
  // que impede a geometria de ser percorrida em toda renderização — e há
  // muitas, porque a tela inteira reage a cada leitura do GPS.
  if (snapshot.geometry === geometry && snapshot.position === position) {
    return snapshot.progress;
  }

  // Rota nova significa trajeto novo: a busca recomeça do primeiro vértice.
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
    // Só avança a memória quando a leitura é confiável: uma posição fora da
    // rota não deve empurrar o ponto de partida da próxima busca.
    index: progress && !progress.isOffRoute ? progress.nearestIndex : fromIndex,
  });

  return progress;
}
