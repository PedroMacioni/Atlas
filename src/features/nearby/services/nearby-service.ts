import { atlasApiUrl, isAtlasApiConfigured } from '@/config/api';
import type { Coordinate } from '@/features/map/types/coordinate';
import type { NearbyCategory, NearbyResponse } from '@/features/nearby/types/nearby';
import type { Decision } from '@/features/trip-session/types/trip';
import { HttpError, fetchJson } from '@/utils/http';

/**
 * Lugares próximos pela API do Atlas: Google Places (com nota), TomTom (sem
 * nota) ou OpenStreetMap (reserva). As chaves ficam no backend.
 */
const NEARBY_PATH = '/v1/nearby';

/**
 * Tempo limite longo de propósito: Google e TomTom respondem em 1–2 s, mas a
 * reserva do OpenStreetMap já levou 23 s num dia cheio.
 */
const TIMEOUT_MS = 35_000;

export function isNearbyAvailable(): boolean {
  return isAtlasApiConfigured();
}

/** Quantos lugares vêm por padrão: 3, como pede o escopo (RF-08). */
export const DEFAULT_NEARBY_LIMIT = 3;

export function fetchNearby(
  category: NearbyCategory,
  around: Coordinate,
  { limit = DEFAULT_NEARBY_LIMIT, signal }: { limit?: number; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams({
    category,
    latitude: String(around.latitude),
    longitude: String(around.longitude),
    limit: String(limit),
  });

  return fetchJson<NearbyResponse>(`${atlasApiUrl(NEARBY_PATH)}?${params.toString()}`, {
    timeoutMs: TIMEOUT_MS,
    signal,
  });
}

/**
 * Que tipo de lugar cada recomendação procura (§4.7). CONTINUAR não busca
 * nada; REGISTRAR PONTO TURÍSTICO registra o lugar onde se está.
 */
export const DECISION_CATEGORY: Partial<Record<Decision, NearbyCategory>> = {
  descansar: 'descanso',
  abastecer: 'posto',
  alimentar: 'restaurante',
  fazer_parada: 'parada',
};

export function describeNearbyError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.code === 'nearby_unavailable') {
      return 'Nenhuma fonte de lugares respondeu agora.';
    }
    if (error.kind === 'timeout') {
      return 'A busca de lugares demorou demais.';
    }
    if (error.kind === 'network') {
      return 'Sem conexão com a API do Atlas.';
    }
  }
  return 'Não foi possível buscar lugares próximos.';
}
