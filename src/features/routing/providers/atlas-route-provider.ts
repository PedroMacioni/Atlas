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
 * Provider de rotas que fala com a API do Atlas.
 *
 * É o provider de produção. A diferença em relação ao `osrmRouteProvider` não
 * está no formato — os dois devolvem o mesmo `RouteResult` — e sim em quem faz
 * o trabalho: aqui o backend escolhe o serviço de rotas, guarda o resultado em
 * cache e mantém as chaves de API fora do aplicativo. Trocar OSRM por Google
 * Routes deixa de exigir um release na loja.
 *
 * O corpo da resposta já vem no formato que a interface consome, então a
 * tradução é mínima: validar e confiar só no que foi validado.
 */
const ROUTES_PATH = '/v1/routes';

/** Formato de `POST /v1/routes`, na parte que consumimos. */
type AtlasRouteResponse = {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  /** Ausente em respostas de versões anteriores da API. */
  steps?: RouteStep[];
  provider: string;
  cached: boolean;
};

/**
 * Traduz a falha em mensagem de tela.
 *
 * O código de domínio da API tem prioridade sobre o status HTTP: ele é
 * estável, descreve a causa e não muda se o transporte mudar.
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
 * Valida as manobras devolvidas pela API.
 *
 * O formato já é o do aplicativo — a API expõe exatamente o tipo `RouteStep` —
 * então aqui não há tradução, apenas a checagem de que cada item tem o que a
 * tela vai ler. Uma manobra malformada é descartada em vez de derrubar a rota:
 * instruções são um extra sobre um trajeto que já é útil sem elas.
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

  async getRoute({ origin, destination, signal }: GetRouteParams): Promise<RouteResult> {
    let payload: AtlasRouteResponse;

    try {
      payload = await fetchJson<AtlasRouteResponse>(atlasApiUrl(ROUTES_PATH), {
        method: 'POST',
        body: { origin, destination },
        signal,
      });
    } catch (error) {
      throw new RouteError(toHumanMessage(error), error);
    }

    return parseRoute(payload);
  },
};
