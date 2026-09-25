import { atlasApiUrl } from '@/config/api';
import type { Coordinate } from '@/features/map/types/coordinate';
import {
  RouteError,
  type GetRouteParams,
  type RouteProvider,
} from '@/features/routing/types/route-provider';
import type { RouteResult, RouteStep } from '@/features/routing/types/route-result';
import { HttpError, fetchJson } from '@/utils/http';

/**
 * Serviço de rotas que usa a API do Atlas (o padrão quando a API está
 * configurada).
 *
 * Devolve o mesmo formato do `osrmRouteProvider`, mas quem faz o trabalho é o
 * backend: ele escolhe o serviço de rotas, guarda em cache e mantém as chaves
 * fora do app. Aqui só validamos a resposta.
 */
const ROUTES_PATH = '/v1/routes';

/** Resposta de `POST /v1/routes` (só os campos que usamos). */
type AtlasRouteResponse = {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  /** Pode não vir em versões antigas da API. */
  steps?: RouteStep[];
  provider: string;
  cached: boolean;
};

/**
 * Converte a falha em mensagem para a tela. O `code` da API vem primeiro,
 * porque descreve a causa melhor que o status HTTP.
 */
function toHumanMessage(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'route_not_found':
        return 'Nenhuma rota foi encontrada entre os pontos informados.';
      case 'route_provider_timeout':
        return 'O serviço de rotas demorou demais para responder.';
      case 'route_provider_unavailable':
        return 'O serviço de rotas está indisponível agora.';
      case 'invalid_request':
        return 'Os pontos informados não formam uma consulta válida.';
    }

    switch (error.kind) {
      case 'timeout':
        return 'A API do Atlas demorou demais para responder.';
      case 'network':
        return 'Sem conexão com a API do Atlas.';
      case 'status':
        return `A API do Atlas respondeu com erro (${error.status}).`;
      case 'invalid-response':
        return 'A API do Atlas devolveu uma resposta inválida.';
    }
  }

  return 'Falha inesperada ao consultar a API do Atlas.';
}

function parseRoute(payload: AtlasRouteResponse): RouteResult {
  const coordinates = (payload.coordinates ?? []).filter(
    (point): point is Coordinate =>
      typeof point?.latitude === 'number' &&
      typeof point?.longitude === 'number' &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude),
  );

  if (coordinates.length < 2) {
    throw new RouteError('A rota recebida não tem pontos suficientes para ser desenhada.');
  }

  if (!Number.isFinite(payload.distanceMeters) || !Number.isFinite(payload.durationSeconds)) {
    throw new RouteError('A rota recebida não trouxe distância e tempo válidos.');
  }

  return {
    coordinates,
    distanceMeters: payload.distanceMeters,
    durationSeconds: payload.durationSeconds,
    steps: parseSteps(payload.steps),
  };
}

/**
 * Valida as manobras que vieram da API. Uma manobra com defeito é descartada
 * em vez de derrubar a rota inteira (as instruções são um extra).
 */
function parseSteps(steps: RouteStep[] | undefined): RouteStep[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.filter(
    (step): step is RouteStep =>
      typeof step?.type === 'string' &&
      Number.isFinite(step?.distanceAlongRouteMeters) &&
      Number.isFinite(step?.location?.latitude) &&
      Number.isFinite(step?.location?.longitude),
  );
}

export const atlasRouteProvider: RouteProvider = {
  id: 'atlas-api',

  async getRoute({
    origin,
    destination,
    waypoints = [],
    signal,
  }: GetRouteParams): Promise<RouteResult> {
    let payload: AtlasRouteResponse;

    try {
      payload = await fetchJson<AtlasRouteResponse>(atlasApiUrl(ROUTES_PATH), {
        method: 'POST',
        body: { origin, destination, waypoints },
        signal,
      });
    } catch (error) {
      throw new RouteError(toHumanMessage(error), error);
    }

    return parseRoute(payload);
  },
};
