import { useCallback, useEffect, useState } from 'react';

import type { Coordinate } from '@/features/map/types/coordinate';
import {
  DEFAULT_NEARBY_LIMIT,
  describeNearbyError,
  fetchNearby,
} from '@/features/nearby/services/nearby-service';
import type { NearbyCategory, NearbyResponse } from '@/features/nearby/types/nearby';

type SearchKey = { category: NearbyCategory; around: Coordinate; attempt: number };

export type NearbySearchState = {
  category: NearbyCategory | null;
  result: NearbyResponse | null;
  isLoading: boolean;
  error: string | null;
  /** Busca uma categoria em volta de um ponto. */
  search: (category: NearbyCategory, around: Coordinate) => void;
  retry: () => void;
  clear: () => void;
};

/**
 * Uma busca de opções próximas por vez.
 *
 * Tocar outra categoria cancela a busca anterior — com a reserva do
 * OpenStreetMap podendo levar vinte segundos, uma resposta atrasada não pode
 * sobrescrever a categoria que o usuário escolheu depois.
 */
export function useNearbySearch(
  /** Busca já na montagem — a emergência abre procurando hospitais. */
  initial?: { category: NearbyCategory; around: Coordinate } | null,
  /** Quantas opções. 3 pelo escopo; a lista da tela de destino pede 10. */
  limit: number = DEFAULT_NEARBY_LIMIT,
): NearbySearchState {
  const [key, setKey] = useState<SearchKey | null>(() =>
    initial ? { ...initial, attempt: 0 } : null,
  );
  const [result, setResult] = useState<NearbyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback((category: NearbyCategory, around: Coordinate) => {
    setResult(null);
    setError(null);
    setKey({ category, around, attempt: 0 });
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setKey((current) => (current ? { ...current, attempt: current.attempt + 1 } : current));
  }, []);

  const clear = useCallback(() => {
    setKey(null);
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!key) {
      return;
    }

    const controller = new AbortController();

    fetchNearby(key.category, key.around, { limit, signal: controller.signal })
      .then(setResult)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(describeNearbyError(cause));
        }
      });

    return () => controller.abort();
  }, [key, limit]);

  return {
    category: key?.category ?? null,
    result,
    isLoading: key !== null && result === null && error === null,
    error,
    search,
    retry,
    clear,
  };
}
