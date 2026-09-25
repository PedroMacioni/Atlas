import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  describeTripError,
  getTrip,
  isTripHistoryAvailable,
  listTrips,
} from '@/features/trip-session/services/trip-session-service';
import type { TripCard, TripDetail } from '@/features/trip-session/types/trip';

type LoadState<T> = {
  isLoading: boolean;
  data: T | null;
  error: string | null;
};

export type LoadResult<T> = LoadState<T> & {
  /** `false` quando não há API configurada (não existe histórico para buscar). */
  isAvailable: boolean;
  reload: () => void;
};

/**
 * Carrega dados do histórico toda vez que a tela ganha foco.
 *
 * Foco, e não só ao abrir: a aba Histórico continua aberta enquanto o usuário
 * faz uma viagem nova, e ao voltar a viagem nova precisa aparecer.
 */
function useFocusedLoad<T>(load: (signal: AbortSignal) => Promise<T>, key: string): LoadResult<T> {
  const isAvailable = isTripHistoryAvailable();
  const [state, setState] = useState<LoadState<T>>({
    isLoading: isAvailable,
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!isAvailable) {
        return;
      }

      const controller = new AbortController();

      load(controller.signal)
        .then((data) => setState({ isLoading: false, data, error: null }))
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            setState((previous) => ({ ...previous, isLoading: false, error: describeTripError(cause) }));
          }
        });

      return () => controller.abort();
      // `load` muda a cada render; quem define a busca é `key`.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAvailable, key, attempt]),
  );

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, isLoading: true, error: null }));
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, isAvailable, reload };
}

/** Histórico do aparelho (RF-28). */
export function useTripHistory(): LoadResult<TripCard[]> {
  return useFocusedLoad((signal) => listTrips(signal), 'history');
}

/** Uma viagem, com trajeto, paradas e diário (RF-26, RF-29). */
export function useTripDetail(tripId: string): LoadResult<TripDetail> {
  return useFocusedLoad((signal) => getTrip(tripId, signal), tripId);
}
