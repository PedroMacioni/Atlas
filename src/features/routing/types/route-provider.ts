import type { Coordinate } from '@/features/map/types/coordinate';
import type { RouteResult } from '@/features/routing/types/route-result';

export type GetRouteParams = {
  origin: Coordinate;
  destination: Coordinate;
  /**
   * Paradas no meio do caminho, em ordem. É assim que um desvio aceito (um
   * posto sugerido pelo Atlas) entra na rota sem trocar o destino.
   */
  waypoints?: Coordinate[];
  /** Permite cancelar a consulta (ex.: quando a tela fecha). */
  signal?: AbortSignal;
};

/**
 * Contrato que todo serviço de rotas precisa seguir.
 *
 * Para trocar o OSRM por Google Routes ou Mapbox, basta criar outra
 * implementação deste tipo e registrar em `route-service.ts`. As telas não mudam.
 */
export type RouteProvider = {
  /** Nome do serviço, usado em logs e diagnóstico. */
  readonly id: string;
  getRoute(params: GetRouteParams): Promise<RouteResult>;
};

/** Erro da camada de rotas, igual para qualquer serviço. */
export class RouteError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RouteError';
    this.cause = cause;
  }
}
