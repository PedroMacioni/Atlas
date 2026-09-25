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
 * Busca de lugares próximos, uma de cada vez.
 *
 * Tocar em outra categoria cancela a busca anterior. Assim uma resposta
 * atrasada (o OpenStreetMap pode levar 20 s) não sobrescreve a escolha nova.
 */
export function useNearbySearch(
  /** Busca já ao abrir (ex.: a emergência abre procurando hospitais). */
  initial?: { category: NearbyCategory; around: Coordinate } | null,
  /** Quantos lugares: 3 pelo escopo; a tela de destino pede 10. */
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
    // Limpa o resultado anterior para a tela mostrar "buscando" de novo.
    setResult(null);
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
