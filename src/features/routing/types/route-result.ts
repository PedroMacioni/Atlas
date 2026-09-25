import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Tipo de manobra (vocabulário do OSRM). Quem transforma em frase é
 * `features/trip/utils/maneuver-text.ts`.
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
   * Distância desde a partida até a manobra. Assim, o que falta até ela é só
   * uma subtração do quanto já se andou.
   */
  distanceAlongRouteMeters: number;
  /** Onde a manobra acontece. */
  location: Coordinate;
};

/**
 * Rota calculada, no formato único que as telas conhecem. Todo serviço de
 * rotas converte a resposta dele para este tipo.
 */
export type RouteResult = {
  /** Pontos da rota (latitude/longitude), prontos para desenhar no mapa. */
  coordinates: Coordinate[];
  /** Distância total do trajeto, em metros. */
  distanceMeters: number;
  /** Duração estimada do trajeto, em segundos. */
  durationSeconds: number;
  /** Manobras em ordem. Vazia quando o serviço não as informa (a tela esconde a faixa). */
  steps: RouteStep[];
};
