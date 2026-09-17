import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import type { NamedCoordinate } from '@/features/map/types/coordinate';
import { DEMO_DESTINATION } from '@/features/trip/constants/demo-route';

/**
 * Destino da viagem, lido dos parâmetros de rota.
 *
 * Coordenada ausente ou inválida cai no trajeto de demonstração em vez de
 * derrubar a tela — é o que mantém a viagem acessível por link direto, e por
 * `atlas://trip`, sem risco.
 */
export function useTripDestination(): NamedCoordinate {
  const params = useLocalSearchParams<{
    name?: string;
    latitude?: string;
    longitude?: string;
  }>();

  return useMemo<NamedCoordinate>(() => {
    const latitude = Number(params.latitude);
    const longitude = Number(params.longitude);

    if (params.name && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { name: params.name, latitude, longitude };
    }

    return DEMO_DESTINATION;
  }, [params.name, params.latitude, params.longitude]);
}
