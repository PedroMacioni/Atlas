import { useCallback, useEffect, useRef, useState } from 'react';

import {
  startTracking,
  type TrackedPosition,
  type TrackingSubscription,
} from '@/features/location/services/location-tracking-service';

export type LocationTrackingState = {
  /** Última posição conhecida, ou `null` enquanto a primeira não chega. */
  position: TrackedPosition | null;
  /** `true` até a primeira leitura (ou até falhar). */
  isStarting: boolean;
  error: string | null;
  /** Nova tentativa depois de uma falha. */
  retry: () => void;
};

/**
 * Acompanha a posição do aparelho enquanto a tela estiver aberta.
 *
 * Parecido com `useCurrentLocation`, mas as leituras continuam chegando.
 *
 * `enabled = false` monta o hook sem ligar o GPS (economiza bateria antes da
 * viagem começar ou na viagem de demonstração).
 */
export function useLocationTracking(enabled = true): LocationTrackingState {
  const [position, setPosition] = useState<TrackedPosition | null>(null);
  const [isStarting, setIsStarting] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A inscrição pode chegar depois da tela fechar; o ref garante o cancelamento.
  const subscription = useRef<TrackingSubscription | null>(null);

  const retry = useCallback(() => {
    setError(null);
    setIsStarting(true);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    startTracking({
      onPosition: (next) => {
        if (!active) {
          return;
        }
        setPosition(next);
        setIsStarting(false);
        // Uma leitura boa depois de uma falha apaga o aviso de erro.
        setError(null);
      },
      onError: (message) => {
        if (!active) {
          return;
        }
        setError(message);
        setIsStarting(false);
      },
    }).then((created) => {
      // A tela fechou enquanto a permissão era pedida: desliga o GPS na hora.
      if (!active) {
        created?.remove();
        return;
      }

      subscription.current = created;
    });

    return () => {
      active = false;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [enabled, attempt]);

  return { position, isStarting, error, retry };
}
