import type { Coordinate } from '@/features/map/types/coordinate';
import {
  RouteError,
  type GetRouteParams,
  type RouteProvider,
} from '@/features/routing/types/route-provider';
import type {
  ManeuverModifier,
  ManeuverType,
  RouteResult,
  RouteStep,
} from '@/features/routing/types/route-result';
import { HttpError, fetchJson } from '@/utils/http';

/**
 * Provider de rotas baseado no servidor público de demonstração do OSRM.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ ATENÇÃO — SOLUÇÃO TEMPORÁRIA DE DESENVOLVIMENTO                      │
 * │                                                                      │
 * │ `router.project-osrm.org` é mantido pelo projeto OSRM apenas como    │
 * │ demonstração. Não possui SLA, não permite uso comercial, aplica      │
 * │ limites de requisição não documentados e pode sair do ar sem aviso.  │
 * │                                                                      │
 * │ Serve para validar o fluxo mapa + rota nesta primeira fase. Antes de │
 * │ qualquer distribuição, troque por Google Routes, Mapbox Directions   │
 * │ ou uma instância própria do OSRM — basta escrever outro RouteProvider│
 * │ e registrá-lo em `src/features/routing/services/route-service.ts`.   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * @see https://project-osrm.org/docs/v5.24.0/api/
 */
const OSRM_BASE_URL = 'https://router.project-osrm.org';

/** Perfil de deslocamento. O servidor público expõe apenas `driving`. */
const OSRM_PROFILE = 'driving';

/** Formato da resposta do endpoint `/route/v1`, na parte que consumimos. */
type OsrmRouteResponse = {
  code: string;
  message?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: {
      type: 'LineString';
      /** GeoJSON usa a ordem [longitude, latitude]. */
      coordinates: [number, number][];
    };
    legs?: {
      steps?: {
        name?: string;
        distance?: number;
        maneuver?: {
          type?: string;
          modifier?: string;
          location?: [number, number];
        };
      }[];
    }[];
  }[];
};

/**
 * Vocabulário do OSRM traduzido para o do Atlas.
 *
 * Esta tabela existe também no backend, em `providers/osrm.py`, e a
 * duplicação é deliberada: este provider é o caminho **sem** backend, e
 * precisa se sustentar sozinho. Quando a API do Atlas passar a ser o único
 * provider de produção, é este arquivo que sai — não a tabela do servidor.
 */
const MANEUVER_TYPES: Record<string, ManeuverType> = {
  depart: 'depart',
  arrive: 'arrive',
  turn: 'turn',
  continue: 'continue',
  merge: 'merge',
  'on ramp': 'on-ramp',
  'off ramp': 'off-ramp',
  fork: 'fork',
  'end of road': 'end-of-road',
  roundabout: 'roundabout',
  rotary: 'rotary',
  'roundabout turn': 'roundabout',
  'new name': 'new-name',
  notification: 'continue',
  'exit roundabout': 'roundabout',
  'exit rotary': 'rotary',
};

const MANEUVER_MODIFIERS: Record<string, ManeuverModifier> = {
  left: 'left',
  right: 'right',
  'sharp left': 'sharp-left',
  'sharp right': 'sharp-right',
  'slight left': 'slight-left',
  'slight right': 'slight-right',
  straight: 'straight',
  uturn: 'uturn',
};

function buildRouteUrl(origin: Coordinate, destination: Coordinate): string {
  const from = `${origin.longitude},${origin.latitude}`;
  const to = `${destination.longitude},${destination.latitude}`;

  // `geometries=geojson` evita ter que decodificar polyline codificada nesta fase.
  const query = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    alternatives: 'false',
    steps: 'false',
  });

  return `${OSRM_BASE_URL}/route/v1/${OSRM_PROFILE}/${from};${to}?${query.toString()}`;
}

function toHumanMessage(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.kind) {
      case 'timeout':
        return 'O serviço de rotas demorou demais para responder.';
      case 'network':
        return 'Sem conexão com o serviço de rotas.';
      case 'status':
        return `O serviço de rotas respondeu com erro (${error.status}).`;
      case 'invalid-response':
        return 'O serviço de rotas devolveu uma resposta inválida.';
    }
  }
  return 'Falha inesperada ao consultar o serviço de rotas.';
}

/** Valida o corpo da resposta antes de confiar nele. */
function parseRoute(payload: OsrmRouteResponse): RouteResult {
  if (payload.code !== 'Ok') {
    throw new RouteError(
      payload.message ?? `O serviço de rotas recusou a consulta (${payload.code}).`,
    );
  }

  const route = payload.routes?.[0];

  if (!route || !Array.isArray(route.geometry?.coordinates)) {
    throw new RouteError('Nenhuma rota foi encontrada entre os pontos informados.');
  }

  const coordinates: Coordinate[] = route.geometry.coordinates
    .filter(
      (pair): pair is [number, number] =>
        Array.isArray(pair) &&
        pair.length >= 2 &&
        Number.isFinite(pair[0]) &&
        Number.isFinite(pair[1]),
    )
    .map(([longitude, latitude]) => ({ latitude, longitude }));

  if (coordinates.length < 2) {
    throw new RouteError('A rota recebida não tem pontos suficientes para ser desenhada.');
  }

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps: parseSteps(route),
  };
}

/**
 * Converte os passos do OSRM em manobras posicionadas sobre a rota.
 *
 * O OSRM descreve cada passo com a manobra no **início** dele e a distância
 * que ele cobre até a próxima. Aqui isso vira distância acumulada desde a
 * partida, que é o formato que a tela usa: o que falta até a manobra é uma
 * subtração do quanto já se percorreu.
 *
 * Manobra nunca derruba uma rota — formato inesperado devolve lista vazia, e a
 * tela simplesmente não mostra a faixa de instrução.
 */
function parseSteps(route: NonNullable<OsrmRouteResponse['routes']>[number]): RouteStep[] {
  const steps: RouteStep[] = [];
  let traveled = 0;

  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const maneuver = step.maneuver;
      const location = maneuver?.location;

      if (
        !Array.isArray(location) ||
        location.length < 2 ||
        !Number.isFinite(location[0]) ||
        !Number.isFinite(location[1])
      ) {
        continue;
      }

      steps.push({
        // Tipo desconhecido vira "continue": seguir em frente é a única
        // instrução que nunca manda o motorista para o lugar errado.
        type: MANEUVER_TYPES[String(maneuver?.type)] ?? 'continue',
        modifier: MANEUVER_MODIFIERS[String(maneuver?.modifier)],
        roadName: step.name ?? '',
        distanceAlongRouteMeters: traveled,
        location: { latitude: location[1], longitude: location[0] },
      });

      if (Number.isFinite(step.distance) && (step.distance ?? 0) > 0) {
        traveled += step.distance as number;
      }
    }
  }

  return steps;
}

export const osrmRouteProvider: RouteProvider = {
  id: 'osrm-public-demo',

  async getRoute({ origin, destination, signal }: GetRouteParams): Promise<RouteResult> {
    let payload: OsrmRouteResponse;

    try {
      payload = await fetchJson<OsrmRouteResponse>(buildRouteUrl(origin, destination), {
        timeoutMs: 12_000,
        signal,
      });
    } catch (error) {
      throw new RouteError(toHumanMessage(error), error);
    }

    return parseRoute(payload);
  },
};
