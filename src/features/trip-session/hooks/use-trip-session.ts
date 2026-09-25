import { useCallback, useEffect, useState } from 'react';

import type { TrackedPosition } from '@/features/location/services/location-tracking-service';
import type { Coordinate, NamedCoordinate } from '@/features/map/types/coordinate';
import {
  addStop,
  describeTripError,
  finishTrip,
  isTripHistoryAvailable,
  startTrip,
  type StopDetails,
} from '@/features/trip-session/services/trip-session-service';
import type { EndReason } from '@/features/trip-session/types/trip';
import {
  appendReading,
  EMPTY_TRACK,
  type TraveledTrack,
} from '@/features/trip-session/utils/traveled-track';

export type TripSessionStatus =
  /** Sem API configurada: a viagem navega, mas não é registrada. */
  | 'unavailable'
  /** Esperando origem e destino resolvidos para abrir a viagem. */
  | 'waiting'
  | 'starting'
  | 'active'
  | 'error';

/**
 * Trajeto e hora do fim, quando quem encerra sabe mais que o GPS (é o caso
 * da viagem de demonstração, que conclui o percurso inteiro de uma vez).
 */
export type FinishOverride = {
  distanceMeters: number;
  path: Coordinate[];
  endedAt?: string;
};

export type TripSession = {
  status: TripSessionStatus;
  tripId: string | null;
  /** Quando a API abriu a viagem, em ISO 8601. */
  startedAt: string | null;
  error: string | null;
  /** Nova tentativa de abrir a viagem depois de uma falha. */
  retry: () => void;
  /**
   * "Registrar parada": grava a posição atual como parada. `details` dá o nome
   * do lugar quando se sabe qual é (ex.: o posto escolhido num desvio).
   */
  registerStop: (details?: StopDetails) => Promise<void>;
  /**
   * Encerra a viagem e devolve o id para abrir o resumo. Lança erro se a API
   * recusar; sem viagem registrada, devolve `null`.
   */
  finish: (reason: EndReason, override?: FinishOverride) => Promise<string | null>;
  /** Distância percorrida até aqui, medida pelo GPS. */
  traveledMeters: number;
};

export type UseTripSessionParams = {
  origin: NamedCoordinate | null;
  destination: NamedCoordinate;
  position: TrackedPosition | null;
};

/**
 * A viagem como registro no backend: abre assim que a origem é conhecida,
 * soma o trajeto percorrido, grava paradas e eventos e encerra com o resumo.
 *
 * A navegação não depende disto: se a API estiver fora, o mapa e a rota
 * continuam; só o diário deixa de ser gravado (e a tela avisa).
 */
export function useTripSession({
  origin,
  destination,
  position,
}: UseTripSessionParams): TripSession {
  const available = isTripHistoryAvailable();

  const [tripId, setTripId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Trajeto percorrido. Atualizado durante a renderização: compara a leitura
  // atual com a última já somada.
  const [track, setTrack] = useState<{ last: TrackedPosition | null; value: TraveledTrack }>({
    last: null,
    value: EMPTY_TRACK,
  });

  if (position && position !== track.last) {
    setTrack({ last: position, value: appendReading(track.value, position) });
  }

  // A viagem abre uma vez só, quando a origem é conhecida (a de demonstração também vale).
  const canStart = available && origin !== null && tripId === null && error === null;

  useEffect(() => {
    if (!canStart || !origin) {
      return;
    }

    let active = true;

    startTrip(origin, destination)
      .then((trip) => {
        if (active) {
          setTripId(trip.id);
          setStartedAt(trip.startedAt);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(describeTripError(cause));
        }
      });

    return () => {
      active = false;
    };
    // `origin` e `destination` não mudam na viagem; só a nova tentativa dispara de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStart, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  const status: TripSessionStatus = !available
    ? 'unavailable'
    : tripId
      ? 'active'
      : error
        ? 'error'
        : origin
          ? 'starting'
          : 'waiting';

  const currentLocation = position?.coordinate ?? null;

  const registerStop = useCallback(async (details?: StopDetails) => {
    if (!tripId || !currentLocation) {
      throw new Error(
        tripId ? 'Sem localização para registrar a parada.' : 'A viagem não está sendo registrada.',
      );
    }

    await addStop(tripId, currentLocation, details);
  }, [tripId, currentLocation]);

  const finish = useCallback(
    async (reason: EndReason, override?: FinishOverride) => {
      if (!tripId) {
        return null;
      }

      const trip = await finishTrip(tripId, {
        endReason: reason,
        distanceMeters: override?.distanceMeters ?? track.value.distanceMeters,
        path: override?.path ?? track.value.points,
        endedAt: override?.endedAt,
        location: override ? override.path[override.path.length - 1] : currentLocation,
      });

      return trip.id;
    },
    [tripId, track.value, currentLocation],
  );

  return {
    status,
    tripId,
    startedAt,
    error,
    retry,
    registerStop,
    finish,
    traveledMeters: track.value.distanceMeters,
  };
}
