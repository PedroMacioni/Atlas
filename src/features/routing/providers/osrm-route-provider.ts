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
 * Serviço de rotas que chama direto o servidor público do OSRM.
 *
 * É usado quando a API do Atlas não está configurada.
 *
 * ATENÇÃO: `router.project-osrm.org` é só para demonstração: sem garantia,
 * sem uso comercial e com limite de uso. Para um produto real, troque por
 * outro serviço criando um novo `RouteProvider` em `route-service.ts`.
 *
 * @see https://project-osrm.org/docs/v5.24.0/api/
 */
const OSRM_BASE_URL = 'https://router.project-osrm.org';

/** O servidor público só tem o perfil de carro (`driving`). */
const OSRM_PROFILE = 'driving';

/**
 * Distância máxima entre o ponto pedido e a rua mais próxima. Sem isso, um
 * ponto no mar seria "encaixado" numa estrada a centenas de km. Mesmo valor
 * usado no backend.
 */
const SNAP_RADIUS_METERS = 10_000;

/** Resposta do `/route/v1` do OSRM (só a parte que usamos). */
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
 * Vocabulário do OSRM convertido para o do Atlas. A mesma tabela existe no
 * backend (`providers/osrm.py`), porque este arquivo funciona sem o backend.
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

function buildRouteUrl(points: Coordinate[]): string {
  const path = points.map((point) => `${point.longitude},${point.latitude}`).join(';');

  // `geometries=geojson` evita decodificar a polyline compactada.
  const query = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    alternatives: 'false',
    // Pede as manobras, usadas na faixa de instrução da viagem.
    steps: 'true',
    // Um raio de encaixe por ponto, na mesma ordem da URL.
    radiuses: points.map(() => SNAP_RADIUS_METERS).join(';'),
  });

  return `${OSRM_BASE_URL}/route/v1/${OSRM_PROFILE}/${path}?${query.toString()}`;
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

/** Valida a resposta antes de usar. */
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
 * Converte os passos do OSRM em manobras posicionadas na rota.
 *
 * O OSRM informa a manobra no início de cada passo e a distância até o
 * próximo. Aqui isso vira "distância desde a partida": o que falta até a
 * manobra é só uma subtração. Se o formato vier estranho, a lista fica vazia.
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
        // Tipo desconhecido vira "continue" (seguir em frente).
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

  async getRoute({
    origin,
    destination,
    waypoints = [],
    signal,
  }: GetRouteParams): Promise<RouteResult> {
    let payload: OsrmRouteResponse;

    try {
      payload = await fetchJson<OsrmRouteResponse>(buildRouteUrl([origin, ...waypoints, destination]), {
        timeoutMs: 12_000,
        signal,
      });
    } catch (error) {
      throw new RouteError(toHumanMessage(error), error);
    }

    return parseRoute(payload);
  },
};
