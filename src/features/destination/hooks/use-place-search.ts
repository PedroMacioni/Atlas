import { useCallback, useEffect, useRef, useState } from 'react';

import { DEMO_PLACES } from '@/features/destination/constants/demo-places';
import { searchPlaces } from '@/features/destination/services/place-service';
import type { Place, PlaceCategory } from '@/features/destination/types/place';
import { filterPlaces } from '@/features/destination/utils/filter-places';
import type { Coordinate } from '@/features/map/types/coordinate';

export type PlaceSearchState = {
  query: string;
  setQuery: (value: string) => void;
  /** Categoria ativa, ou `null` quando nenhuma está selecionada. */
  category: PlaceCategory | null;
  /** Seleciona a categoria, ou a desmarca se já estiver ativa. */
  toggleCategory: (value: PlaceCategory) => void;
  /** Resultado da busca. */
  results: Place[];
  /** `true` enquanto a consulta está em andamento. */
  isLoading: boolean;
  /**
   * Preenchido quando a API falhou e a lista veio da cópia local. A tela
   * continua funcionando; a mensagem só explica que a lista pode estar menor.
   */
  error: string | null;
  /** `true` quando a consulta terminou e nada foi encontrado. */
  isEmpty: boolean;
};

/** Espera um pouco antes de buscar, para não fazer uma chamada a cada tecla. */
const DEBOUNCE_MS = 250;

const FALLBACK_MESSAGE = 'Sem conexão com a API — mostrando a lista local.';

/**
 * Busca de destino.
 *
 * A fonte é escolhida em `place-service` (API ou lista local). O hook cuida
 * da tela: texto digitado, categoria e estado da busca, com três cuidados:
 *
 * - espera o usuário parar de digitar (debounce);
 * - ignora respostas atrasadas de buscas antigas;
 * - se a API falhar, mostra a lista local em vez de uma lista vazia.
 *
 * `near` é a posição do usuário. Ela vai junto em cada busca, mas mudar de
 * posição não dispara uma busca nova (só texto e categoria disparam).
 */
export function usePlaceSearch(near: Coordinate | null = null): PlaceSearchState {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PlaceCategory | null>(null);

  // Começa já mostrando a lista local; a resposta da API substitui quando chegar.
  const [results, setResults] = useState<Place[]>(() =>
    filterPlaces({ places: DEMO_PLACES, query: '', category: null }),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conta as buscas para descartar respostas fora de ordem.
  const latestRequest = useRef(0);

  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  const toggleCategory = useCallback((value: PlaceCategory) => {
    setCategory((current) => (current === value ? null : value));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const timeoutId = setTimeout(() => {
      setIsLoading(true);

      searchPlaces({ query, category, near: nearRef.current, signal: controller.signal })
        .then((places) => {
          if (latestRequest.current !== requestId) {
            return;
          }
          setResults(places);
          setError(null);
        })
        .catch(() => {
          if (latestRequest.current !== requestId) {
            return;
          }
          // A lista local responde a mesma busca, só com menos lugares.
          setResults(filterPlaces({ places: DEMO_PLACES, query, category }));
          setError(FALLBACK_MESSAGE);
        })
        .finally(() => {
          if (latestRequest.current === requestId) {
            setIsLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, category]);

  return {
    query,
    setQuery,
    category,
    toggleCategory,
    results,
    isLoading,
    error,
    isEmpty: !isLoading && results.length === 0,
  };
}
