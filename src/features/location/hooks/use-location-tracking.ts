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
 * Acompanha a posição do aparelho enquanto a tela estiver montada.
 *
 * A assinatura é a de `useCurrentLocation`, de propósito — a diferença está no
 * que acontece depois da primeira leitura: aqui elas continuam chegando.
 *
 * `enabled` permite montar o hook sem ligar o GPS. Serve para não gastar
 * bateria antes de a viagem realmente começar, e para desligar o
 * acompanhamento quando ela termina.
 */
export function useLocationTracking(enabled = true): LocationTrackingState {
  const [position, setPosition] = useState<TrackedPosition | null>(null);
  const [isStarting, setIsStarting] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A inscrição pode chegar depois de a tela desmontar; o ref garante que ela
  // seja cancelada de todo jeito.
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
        // Uma leitura boa depois de uma falha temporária limpa o aviso.
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
      // Desmontou enquanto a permissão era resolvida: cancela na hora, em vez
      // de deixar o GPS ligado sem ninguém ouvindo.
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
