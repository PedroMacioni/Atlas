import { atlasApiUrl, isAtlasApiConfigured } from '@/config/api';
import { DEMO_PLACES } from '@/features/destination/constants/demo-places';
import type { Place, PlaceCategory } from '@/features/destination/types/place';
import { filterPlaces } from '@/features/destination/utils/filter-places';
import { fetchJson } from '@/utils/http';

/**
 * Catálogo de destinos.
 *
 * Duas fontes, um formato. Com a API configurada, a busca e o filtro são
 * resolvidos no banco — insensíveis a acento, e sem limite de tamanho da
 * lista. Sem API, a mesma consulta é respondida pela lista local com
 * `filterPlaces`, a função pura que a tela já usava.
 *
 * A assinatura é assíncrona nos dois casos de propósito: a tela não deve
 * mudar de forma quando a fonte muda.
 */
const PLACES_PATH = '/v1/places';

export type SearchPlacesParams = {
  query: string;
  category: PlaceCategory | null;
  signal?: AbortSignal;
};

type AtlasPlacesResponse = {
  places: Place[];
  count: number;
};

/** Quantos lugares uma busca traz de volta. A tela lista, não pagina. */
const RESULT_LIMIT = 50;

export async function searchPlaces({
  query,
  category,
  signal,
}: SearchPlacesParams): Promise<Place[]> {
  if (!isAtlasApiConfigured()) {
    return filterPlaces({ places: DEMO_PLACES, query, category });
  }

  const params = new URLSearchParams({ limit: String(RESULT_LIMIT) });

  // Parâmetro ausente e parâmetro vazio significam coisas diferentes para a
  // API: só envia o que o usuário realmente escolheu.
  if (query.trim()) {
    params.set('query', query.trim());
  }

  if (category) {
    params.set('category', category);
  }

  const payload = await fetchJson<AtlasPlacesResponse>(
    `${atlasApiUrl(PLACES_PATH)}?${params.toString()}`,
    { signal },
  );

  return Array.isArray(payload.places) ? payload.places : [];
}

/** Fonte de lugares em uso, para diagnóstico. */
export function getPlaceSourceId(): string {
  return isAtlasApiConfigured() ? 'atlas-api' : 'lista-local';
}
