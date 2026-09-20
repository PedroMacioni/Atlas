import type { IconName } from '@/components/ui/icon-badge';
import type { ColorToken } from '@/theme/colors';

/**
 * Opções próximas — o formato de `GET /v1/nearby`.
 *
 * As 5 categorias visuais do escopo (RF-07) e duas que só as recomendações
 * usam (§4.7): DESCANSAR busca posto ou hotel, FAZER UMA PARADA busca um local
 * de pausa.
 */
export type NearbyCategory =
  | 'posto'
  | 'restaurante'
  | 'hotel'
  | 'ponto_turistico'
  | 'hospital'
  | 'descanso'
  | 'parada';

export type NearbyPlace = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** De carro quando `byRoad`; senão, em linha reta. */
  distanceMeters: number;
  durationSeconds: number | null;
  byRoad: boolean;
  /** Nota de 1 a 5. `null` quando a fonte não tem nota (TomTom, OpenStreetMap). */
  rating: number | null;
  ratingCount: number | null;
};

export type NearbyResponse = {
  category: NearbyCategory;
  /** `google-places`, `tomtom` ou `openstreetmap`. */
  source: string;
  fallbackReason: string | null;
  places: NearbyPlace[];
};

/** As categorias visuais do escopo, na ordem em que aparecem (RF-07). */
export const SCOPE_CATEGORIES: {
  id: NearbyCategory;
  label: string;
  icon: IconName;
  color: ColorToken;
}[] = [
  { id: 'posto', label: 'Posto', icon: 'gas-station', color: 'categoryFuel' },
  { id: 'restaurante', label: 'Restaurante', icon: 'silverware-fork-knife', color: 'categoryFood' },
  { id: 'hotel', label: 'Hotel', icon: 'bed', color: 'categoryLodging' },
  { id: 'ponto_turistico', label: 'Turismo', icon: 'camera-marker', color: 'categoryNature' },
  { id: 'hospital', label: 'Hospital', icon: 'hospital-box', color: 'categoryHealth' },
];
