import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Categorias de lugar. `other` só vem da busca externa (TomTom): um shopping,
 * um endereço... `recent` só existe no app: um destino do histórico.
 */
export type PlaceCategory = 'fuel' | 'food' | 'parking' | 'saved' | 'other' | 'recent';

/** Um destino possível. */
export type Place = Coordinate & {
  id: string;
  name: string;
  /** Endereço ou referência curta, exibida sob o nome. */
  address: string;
  category: PlaceCategory;
  /** Marcado pelo usuário. Aparece no filtro "Salvos". */
  saved?: boolean;
};
