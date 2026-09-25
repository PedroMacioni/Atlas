import * as Location from 'expo-location';

import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Localização do aparelho (uma leitura só).
 *
 * Pedimos permissão só com o app aberto (foreground); localização em segundo
 * plano não é necessária.
 *
 * Esta função nunca lança erro: toda falha vira um resultado, para a tela
 * continuar funcionando mesmo sem GPS.
 */
export type LocationOutcome =
  | { status: 'granted'; coordinate: Coordinate }
  | { status: 'denied'; message: string }
  | { status: 'disabled'; message: string }
  | { status: 'unavailable'; message: string };

export async function getCurrentLocation(): Promise<LocationOutcome> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return {
        status: 'disabled',
        message: 'A localização do aparelho está desligada.',
      };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== Location.PermissionStatus.GRANTED) {
      return {
        status: 'denied',
        message: 'Permissão de localização negada.',
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      status: 'granted',
      coordinate: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return {
      status: 'unavailable',
      message: 'Não foi possível obter sua localização agora.',
    };
  }
}
