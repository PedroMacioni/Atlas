import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Categorias de lugar da busca de destino. `other` só vem da busca externa
 * (TomTom): um shopping, uma faculdade, um endereço. `recent` só existe no
 * aplicativo: um destino tirado do histórico de viagens.
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
