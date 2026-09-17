import * as Location from 'expo-location';

import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Rastreamento contínuo de posição, para a viagem em andamento.
 *
 * Separado de `location-service.ts` porque o problema é outro: lá a pergunta é
 * "onde estou agora", respondida uma vez ao abrir a tela; aqui é "onde estou
 * a cada instante", enquanto o trajeto acontece.
 *
 * Só *foreground*: o rastreamento vive enquanto a tela de viagem está aberta.
 * Localização em segundo plano exige justificativa nas lojas e um módulo de
 * tarefas — fica para quando a navegação puder continuar com o app fechado.
 *
 * @see https://docs.expo.dev/versions/v57.0.0/sdk/location/
 */

/** Leitura de posição enriquecida com o que a navegação aproveita. */
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
 * Precisão e cadência das leituras.
 *
 * `BestForNavigation` é o nível mais alto, que soma sensores adicionais à
 * leitura — é o que a plataforma oferece para trajeto em movimento, e custa
 * bateria à altura. Aceitável porque o rastreamento só existe com a tela de
 * viagem aberta.
 *
 * `distanceInterval` de 10 m é o que evita a enxurrada de atualizações com o
 * carro parado no semáforo: sem ele, uma leitura por segundo redesenharia a
 * tela sem nada ter mudado. O `timeInterval` é o teto no Android.
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
 * Nunca lança: toda falha chega por `onError`, para que a tela de viagem
 * continue de pé mostrando a rota — sem GPS ela perde o acompanhamento, não a
 * utilidade.
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
      // O terceiro parâmetro recebe falhas que acontecem *depois* de o
      // rastreamento começar — sinal perdido, GPS desligado no meio do
      // trajeto. Sem ele, a tela ficaria congelada sem explicação.
      (error) => onError(String(error)),
    );
  } catch {
    onError('Não foi possível acompanhar sua localização agora.');
    return null;
  }
}
