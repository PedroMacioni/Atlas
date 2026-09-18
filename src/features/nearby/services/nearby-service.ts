import { atlasApiUrl, isAtlasApiConfigured } from '@/config/api';
import type { Coordinate } from '@/features/map/types/coordinate';
import type { NearbyCategory, NearbyResponse } from '@/features/nearby/types/nearby';
import type { Decision } from '@/features/trip-session/types/trip';
import { HttpError, fetchJson } from '@/utils/http';

/**
 * Opções próximas pela API do Atlas: Google Places com nota, ou
 * OpenStreetMap de reserva quando o Google não responde.
 *
 * A chave do Google fica no backend — nunca no aplicativo.
 */
const NEARBY_PATH = '/v1/nearby';

/**
 * Longo de propósito. Pelo Google a resposta vem em 1 a 2 s; pela reserva do
 * OpenStreetMap, medida em 23 s num dia carregado. Desistir antes disso
 * deixaria quem está na estrada sem lista nenhuma.
 */
const TIMEOUT_MS = 35_000;

export function isNearbyAvailable(): boolean {
  return isAtlasApiConfigured();
}

export function fetchNearby(category: NearbyCategory, around: Coordinate, signal?: AbortSignal) {
  const params = new URLSearchParams({
    category,
    latitude: String(around.latitude),
    longitude: String(around.longitude),
  });

  return fetchJson<NearbyResponse>(`${atlasApiUrl(NEARBY_PATH)}?${params.toString()}`, {
    timeoutMs: TIMEOUT_MS,
    signal,
  });
}

/**
 * Que tipo de lugar cada recomendação precisa (§4.7). CONTINUAR não busca
 * nada; REGISTRAR PONTO TURÍSTICO registra onde se está.
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
      return 'Nem o Google nem o OpenStreetMap responderam agora.';
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
