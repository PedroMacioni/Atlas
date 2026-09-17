import { useCallback, useEffect, useRef, useState } from 'react';

import { DEMO_PLACES } from '@/features/destination/constants/demo-places';
import { searchPlaces } from '@/features/destination/services/place-service';
import type { Place, PlaceCategory } from '@/features/destination/types/place';
import { filterPlaces } from '@/features/destination/utils/filter-places';

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
   * Preenchido quando a API falhou e a lista exibida veio da cópia local.
   * A tela continua usável; a mensagem só explica por que o resultado pode
   * estar incompleto.
   */
  error: string | null;
  /** `true` quando a consulta terminou e nada foi encontrado. */
  isEmpty: boolean;
};

/** Espera antes de consultar, para não disparar uma chamada por tecla. */
const DEBOUNCE_MS = 250;

const FALLBACK_MESSAGE = 'Sem conexão com a API — mostrando a lista local.';

/**
 * Busca de destino.
 *
 * A fonte é decidida em `place-service`: a API do Atlas quando configurada,
 * a lista local quando não. O hook cuida do que é da tela — o texto digitado,
 * a categoria, o estado da consulta — e de três cuidados que a rede exige e a
 * lista local não exigia:
 *
 * - **debounce**, para que digitar "Ibirapuera" não gere dez requisições;
 * - **cancelamento**, para que uma resposta atrasada não sobrescreva uma
 *   busca mais recente;
 * - **degradação**, porque uma busca sem rede deve mostrar o que existe
 *   localmente em vez de uma lista vazia.
 */
export function usePlaceSearch(): PlaceSearchState {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PlaceCategory | null>(null);

  // O primeiro render já mostra a lista local, e não um vazio que pisca: o
  // resultado da API substitui isso assim que chega.
  const [results, setResults] = useState<Place[]>(() =>
    filterPlaces({ places: DEMO_PLACES, query: '', category: null }),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conta as buscas para descartar respostas fora de ordem.
  const latestRequest = useRef(0);

  const toggleCategory = useCallback((value: PlaceCategory) => {
    setCategory((current) => (current === value ? null : value));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const timeoutId = setTimeout(() => {
      setIsLoading(true);

      searchPlaces({ query, category, signal: controller.signal })
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
          // A cópia local responde a mesma pergunta, só com menos lugares.
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
