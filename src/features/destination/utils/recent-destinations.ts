import type { Place } from '@/features/destination/types/place';
import type { TripCard } from '@/features/trip-session/types/trip';
import { distanceBetween } from '@/utils/geo';

/** Quantos destinos a lista "Últimos" mostra. */
export const RECENT_LIMIT = 10;

/** Dois destinos com o mesmo nome a menos de 150 m são o mesmo lugar. */
const SAME_PLACE_METERS = 150;

/**
 * Monta a lista de últimos destinos a partir do histórico de viagens.
 *
 * As viagens chegam da mais recente para a mais antiga, e cada lugar aparece
 * uma vez só (ir três vezes à faculdade não empurra os outros para fora).
 */
export function recentDestinations(trips: TripCard[], limit = RECENT_LIMIT): Place[] {
  const places: Place[] = [];

  for (const trip of trips) {
    const name = trip.destinationName.trim();
    const repeated = places.some(
      (place) =>
        place.name.toLowerCase() === name.toLowerCase() &&
        distanceBetween(place, trip.destination) < SAME_PLACE_METERS,
    );

    if (!name || repeated) {
      continue;
    }

    places.push({
      id: `recent:${trip.id}`,
      name,
      address: describeWhen(trip.startedAt),
      category: 'recent',
      latitude: trip.destination.latitude,
      longitude: trip.destination.longitude,
    });

    if (places.length === limit) {
      break;
    }
  }

  return places;
}

/** "Hoje", "Ontem" ou "Em 18/09": quando foi a última viagem até lá. */
function describeWhen(startedAt: string, now = new Date()): string {
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) {
    return 'Viagem anterior';
  }

  const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((day(now) - day(started)) / 86_400_000);

  if (days === 0) {
    return 'Hoje';
  }
  if (days === 1) {
    return 'Ontem';
  }

  const date = `${String(started.getDate()).padStart(2, '0')}/${String(started.getMonth() + 1).padStart(2, '0')}`;
  return `Em ${date}`;
}
