import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Tipo de manobra.
 *
 * O vocabulário é o do OSRM, normalizado: quem traduz para frase é a camada de
 * apresentação, em `features/trip/utils/maneuver-text.ts`. O provider entrega
 * o dado, a tela escolhe as palavras.
 */
export type ManeuverType =
  | 'depart'
  | 'arrive'
  | 'turn'
  | 'continue'
  | 'merge'
  | 'on-ramp'
  | 'off-ramp'
  | 'fork'
  | 'end-of-road'
  | 'roundabout'
  | 'rotary'
  | 'new-name';

/** Para que lado, quando o tipo sozinho não basta. */
export type ManeuverModifier =
  | 'left'
  | 'right'
  | 'sharp-left'
  | 'sharp-right'
  | 'slight-left'
  | 'slight-right'
  | 'straight'
  | 'uturn';

/** Uma manobra do trajeto, posicionada sobre a rota. */
export type RouteStep = {
  type: ManeuverType;
  modifier?: ManeuverModifier;
  /** Via em que o motorista entra depois da manobra. Vazia em alças sem nome. */
  roadName: string;
  /**
   * Distância, desde a partida, até o ponto onde a manobra acontece.
   *
   * É medida assim — e não como "tamanho do passo" — para que saber o que
   * falta até a próxima manobra seja uma subtração do quanto já se percorreu.
   */
  distanceAlongRouteMeters: number;
  /** Onde a manobra acontece. */
  location: Coordinate;
};

/**
 * Resultado normalizado de um cálculo de rota.
 *
 * Este é o único formato que a camada de UI conhece. Qualquer provider
 * (API do Atlas, OSRM, Google Routes, Mapbox Directions) deve converter sua
 * resposta para este tipo.
 */
export type RouteResult = {
  /** Geometria da rota, já em latitude/longitude, pronta para a Polyline. */
  coordinates: Coordinate[];
  /** Distância total do trajeto, em metros. */
  distanceMeters: number;
  /** Duração estimada do trajeto, em segundos. */
  durationSeconds: number;
  /**
   * Manobras, em ordem. Vazia quando o provider não as fornece — a tela
   * esconde a faixa de instrução nesse caso, em vez de inventar uma.
   */
  steps: RouteStep[];
};
