import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Place } from '@/features/destination/types/place';
import { recentDestinations } from '@/features/destination/utils/recent-destinations';
import {
  isTripHistoryAvailable,
  listTrips,
} from '@/features/trip-session/services/trip-session-service';

export type RecentDestinationsState = {
  places: Place[];
  isLoading: boolean;
  /** `true` quando o histórico não pôde ser lido — sem API ou sem rede. */
  unavailable: boolean;
};

/**
 * Os últimos destinos do aparelho, tirados do histórico de viagens.
 *
 * Recarrega sempre que a tela ganha foco: quem volta de uma viagem vê o
 * destino dela no topo da lista.
 */
export function useRecentDestinations(): RecentDestinationsState {
  const available = isTripHistoryAvailable();
  const [state, setState] = useState<RecentDestinationsState>({
    places: [],
    isLoading: available,
    unavailable: !available,
  });

  useFocusEffect(
    useCallback(() => {
      if (!available) {
        return;
      }

      const controller = new AbortController();

      listTrips(controller.signal)
        .then((trips) =>
          setState({ places: recentDestinations(trips), isLoading: false, unavailable: false }),
        )
        .catch(() => {
          if (!controller.signal.aborted) {
            setState((previous) => ({ ...previous, isLoading: false, unavailable: true }));
          }
        });

      return () => controller.abort();
    }, [available]),
  );

  return state;
}
