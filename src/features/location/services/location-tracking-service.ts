import * as Location from 'expo-location';

import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Acompanhamento contínuo da posição durante a viagem.
 *
 * Diferente de `location-service.ts` (uma leitura só ao abrir a tela), aqui as
 * leituras continuam chegando enquanto a tela de viagem está aberta. Só
 * funciona com o app aberto (sem segundo plano).
 *
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/location/
 */

/** Uma leitura de posição, com os dados extras que a navegação usa. */
export type TrackedPosition = {
  coordinate: Coordinate;
  /** Velocidade em m/s, quando o aparelho informa. */
  speed: number | null;
  /** Direção em graus, quando o aparelho informa. */
  heading: number | null;
  /** Raio de incerteza em metros, quando informado. */
  accuracy: number | null;
  /** Momento da leitura, em milissegundos. */
  timestamp: number;
};

export type TrackingSubscription = {
  remove: () => void;
};

export type StartTrackingParams = {
  onPosition: (position: TrackedPosition) => void;
  onError: (message: string) => void;
};

/**
 * Precisão e frequência das leituras.
 *
 * `BestForNavigation` é a precisão máxima (gasta mais bateria, mas só com a
 * tela de viagem aberta). `distanceInterval: 10` evita leituras repetidas com
 * o carro parado no semáforo.
 */
const TRACKING_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 10,
  timeInterval: 2_000,
};

function toTrackedPosition(location: Location.LocationObject): TrackedPosition {
  return {
    coordinate: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    },
    speed: location.coords.speed,
    heading: location.coords.heading,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

/**
 * Começa a acompanhar a posição.
 *
 * Nunca lança erro: as falhas chegam por `onError`, e a tela continua
 * mostrando a rota mesmo sem GPS.
 */
export async function startTracking({
  onPosition,
  onError,
}: StartTrackingParams): Promise<TrackingSubscription | null> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      onError('A localização do aparelho está desligada.');
      return null;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== Location.PermissionStatus.GRANTED) {
      onError('Permissão de localização negada.');
      return null;
    }

    return await Location.watchPositionAsync(
      TRACKING_OPTIONS,
      (location) => onPosition(toTrackedPosition(location)),
      // Recebe falhas que acontecem depois de começar (sinal perdido, GPS desligado).
      (error) => onError(String(error)),
    );
  } catch {
    onError('Não foi possível acompanhar sua localização agora.');
    return null;
  }
}
