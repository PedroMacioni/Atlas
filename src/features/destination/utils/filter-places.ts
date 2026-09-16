import type { Place, PlaceCategory } from '@/features/destination/types/place';

/**
 * Remove acentos e caixa para que "sao paulo" encontre "São Paulo".
 *
 * `normalize('NFD')` separa a letra do acento e o intervalo `̀-ͯ`
 * descarta os acentos soltos.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export type FilterPlacesParams = {
  places: Place[];
  /** Texto digitado. Vazio não filtra nada. */
  query: string;
  /** Categoria selecionada, ou `null` para todas. */
  category: PlaceCategory | null;
};

/**
 * Filtra lugares por texto e categoria.
 *
 * Função pura, sem dependência de React ou de rede — é onde a busca de fato
 * acontece nesta fase, e pode ser testada isoladamente.
 *
 * A categoria `saved` é especial: filtra pela marcação do usuário em vez da
 * categoria do lugar, porque um posto salvo continua sendo um posto.
 */
export function filterPlaces({ places, query, category }: FilterPlacesParams): Place[] {
  const term = normalize(query);

  return places.filter((place) => {
    const matchesCategory =
      category === null ||
      (category === 'saved' ? place.saved === true : place.category === category);

    if (!matchesCategory) {
      return false;
    }

    if (term.length === 0) {
      return true;
    }

    return normalize(place.name).includes(term) || normalize(place.address).includes(term);
  });
}
