import type { Coordinate } from '@/features/map/types/coordinate';
import type { RouteResult } from '@/features/routing/types/route-result';

export type GetRouteParams = {
  origin: Coordinate;
  destination: Coordinate;
  /**
   * Paradas no meio do caminho, em ordem. É como um desvio aceito pelo
   * usuário — um posto sugerido pelo Atlas — entra na rota sem trocar o
   * destino da viagem.
   */
  waypoints?: Coordinate[];
  /** Permite cancelar a consulta quando a tela é desmontada. */
  signal?: AbortSignal;
};

/**
 * Contrato que qualquer serviço de rotas precisa cumprir.
 *
 * Trocar OSRM por Google Routes ou Mapbox Directions significa escrever uma
 * nova implementação deste tipo e registrá-la em `route-service.ts`. Nenhum
 * componente de interface precisa mudar.
 */
export type RouteProvider = {
  /** Identificador legível, usado em logs e mensagens de diagnóstico. */
  readonly id: string;
  getRoute(params: GetRouteParams): Promise<RouteResult>;
};

/** Erro de domínio da camada de rotas, independente do provider. */
export class RouteError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RouteError';
    this.cause = cause;
  }
}
