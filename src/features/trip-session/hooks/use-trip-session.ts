import { useCallback, useEffect, useState } from 'react';

import type { TrackedPosition } from '@/features/location/services/location-tracking-service';
import type { NamedCoordinate } from '@/features/map/types/coordinate';
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

export type TripSession = {
  status: TripSessionStatus;
  tripId: string | null;
  error: string | null;
  /** Nova tentativa de abrir a viagem depois de uma falha. */
  retry: () => void;
  /**
   * "Registrar parada" — grava a posição atual como parada. `details` nomeia
   * o lugar quando se sabe qual é (um desvio que chegou ao posto escolhido).
   */
  registerStop: (details?: StopDetails) => Promise<void>;
  /**
   * Encerra e devolve o id da viagem para abrir o resumo. Lança se a API
   * recusar; sem viagem registrada, devolve `null` e a tela só sai.
   */
  finish: (reason: EndReason) => Promise<string | null>;
  /** Distância percorrida até aqui, medida pelo GPS. */
  traveledMeters: number;
};

export type UseTripSessionParams = {
  origin: NamedCoordinate | null;
  destination: NamedCoordinate;
  position: TrackedPosition | null;
};

/**
 * A viagem como registro: abre no backend assim que a origem é conhecida,
 * acumula o trajeto percorrido, grava paradas e eventos, e encerra com o
 * resumo.
 *
 * A navegação não depende disto. Se a API estiver fora, o mapa e a rota
 * continuam; só o diário deixa de ser escrito — e a tela avisa.
 */
export function useTripSession({
  origin,
  destination,
  position,
}: UseTripSessionParams): TripSession {
  const available = isTripHistoryAvailable();

  const [tripId, setTripId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Trajeto percorrido. Atualizado durante a renderização, comparando a
  // leitura atual com a última já somada — o mesmo padrão de derivar estado
  // de props que `use-trip-progress` usa, sem efeito e sem ref.
  const [track, setTrack] = useState<{ last: TrackedPosition | null; value: TraveledTrack }>({
    last: null,
    value: EMPTY_TRACK,
  });

  if (position && position !== track.last) {
    setTrack({ last: position, value: appendReading(track.value, position) });
  }

  // A viagem abre uma vez só, quando a origem fica conhecida. Origem de
  // demonstração também conta: sem GPS a viagem ainda existe.
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
    // `origin` e `destination` são fixos durante a viagem; a nova tentativa
    // é o que dispara de novo.
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
    async (reason: EndReason) => {
      if (!tripId) {
        return null;
      }

      const trip = await finishTrip(tripId, {
        endReason: reason,
        distanceMeters: track.value.distanceMeters,
        path: track.value.points,
        location: currentLocation,
      });

      return trip.id;
    },
    [tripId, track.value, currentLocation],
  );

  return {
    status,
    tripId,
    error,
    retry,
    registerStop,
    finish,
    traveledMeters: track.value.distanceMeters,
  };
}
