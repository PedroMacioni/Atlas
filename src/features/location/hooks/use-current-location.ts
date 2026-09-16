import { useCallback, useEffect, useState } from 'react';

import { getCurrentLocation, type LocationOutcome } from '@/features/location/services/location-service';
import type { Coordinate } from '@/features/map/types/coordinate';

type LocationSnapshot = {
  isLoading: boolean;
  coordinate: Coordinate | null;
  error: string | null;
};

export type CurrentLocationState = LocationSnapshot & {
  /** Dispara uma nova tentativa (usado pelo botão "Tentar novamente"). */
  retry: () => void;
};

const PENDING: LocationSnapshot = { isLoading: true, coordinate: null, error: null };

/**
 * Obtém a localização atual ao montar a tela.
 *
 * A ausência de localização nunca é bloqueante: o restante da tela — mapa,
 * rota e card — continua funcionando normalmente.
 */
export function useCurrentLocation(): CurrentLocationState {
  const [snapshot, setSnapshot] = useState<LocationSnapshot>(PENDING);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    // Volta ao estado pendente aqui, e não dentro do efeito, para não
    // encadear renderizações desnecessárias.
    setSnapshot(PENDING);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    getCurrentLocation().then((outcome: LocationOutcome) => {
      if (!active) {
        return;
      }

      setSnapshot(
        outcome.status === 'granted'
          ? { isLoading: false, coordinate: outcome.coordinate, error: null }
          : { isLoading: false, coordinate: null, error: outcome.message },
      );
    });

    return () => {
      active = false;
    };
  }, [attempt]);

  return { ...snapshot, retry };
}
