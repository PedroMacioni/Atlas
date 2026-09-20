import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Categorias de lugar da busca de destino. `other` só vem da busca externa
 * (TomTom): um shopping, uma faculdade, um endereço.
 */
export type PlaceCategory = 'fuel' | 'food' | 'parking' | 'saved' | 'other';

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
