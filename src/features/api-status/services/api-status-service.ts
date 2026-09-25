import { atlasApiUrl, isAtlasApiConfigured } from '@/config/api';
import type { ApiHealth } from '@/features/api-status/types/api-status';
import { fetchJson } from '@/utils/http';

/**
 * Consulta o `/health` da API (CA-01). Ele responde mesmo com algo fora do ar
 * e diz o que está funcionando: banco, Random Forest, câmera e emoção na voz.
 */
const HEALTH_PATH = '/health';

/** Tempo curto: a tela não pode ficar esperando o diagnóstico. */
const TIMEOUT_MS = 5_000;

export function isApiConfigured(): boolean {
  return isAtlasApiConfigured();
}

export function fetchHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return fetchJson<ApiHealth>(atlasApiUrl(HEALTH_PATH), { timeoutMs: TIMEOUT_MS, signal });
}
