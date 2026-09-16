import { useCallback, useMemo, useState } from 'react';

import { DEMO_PLACES } from '@/features/destination/constants/demo-places';
import type { Place, PlaceCategory } from '@/features/destination/types/place';
import { filterPlaces } from '@/features/destination/utils/filter-places';

export type PlaceSearchState = {
  query: string;
  setQuery: (value: string) => void;
  /** Categoria ativa, ou `null` quando nenhuma está selecionada. */
  category: PlaceCategory | null;
  /** Seleciona a categoria, ou a desmarca se já estiver ativa. */
  toggleCategory: (value: PlaceCategory) => void;
  /** Resultado do filtro, na ordem original da lista. */
  results: Place[];
  /** `true` quando há busca ou filtro ativo e nada foi encontrado. */
  isEmpty: boolean;
};

/**
 * Busca de destino sobre a lista local de lugares.
 *
 * Toda a filtragem é síncrona e local — não há rede envolvida nesta fase. O
 * hook existe para manter esse estado fora da tela; trocar `DEMO_PLACES` por
 * um resultado do Google Places não muda a interface.
 */
export function usePlaceSearch(): PlaceSearchState {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PlaceCategory | null>(null);

  const toggleCategory = useCallback((value: PlaceCategory) => {
    setCategory((current) => (current === value ? null : value));
  }, []);

  const results = useMemo(
    () => filterPlaces({ places: DEMO_PLACES, query, category }),
    [query, category],
  );

  return {
    query,
    setQuery,
    category,
    toggleCategory,
    results,
    isEmpty: results.length === 0,
  };
}
