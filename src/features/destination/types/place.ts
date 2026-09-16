import type { Coordinate } from '@/features/map/types/coordinate';

/** Categorias de lugar oferecidas na busca de destino. */
export type PlaceCategory = 'fuel' | 'food' | 'parking' | 'saved';

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
