import type { IconName } from '@/components/ui/icon-badge';
import type { ColorToken } from '@/theme/colors';
import type { PlaceCategory } from '@/features/destination/types/place';

export type CategoryDefinition = {
  id: PlaceCategory;
  label: string;
  icon: IconName;
  color: ColorToken;
};

/** Filtros rápidos da busca de destino, na ordem em que aparecem. */
export const PLACE_CATEGORIES: CategoryDefinition[] = [
  { id: 'fuel', label: 'Posto', icon: 'gas-station', color: 'categoryFuel' },
  { id: 'food', label: 'Comida', icon: 'silverware-fork-knife', color: 'categoryFood' },
  { id: 'parking', label: 'Estacionar', icon: 'car-brake-parking', color: 'categoryLodging' },
  { id: 'saved', label: 'Salvos', icon: 'bookmark', color: 'categoryHealth' },
];
