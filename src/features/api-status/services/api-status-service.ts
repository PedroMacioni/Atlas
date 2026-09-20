import { atlasApiUrl, isAtlasApiConfigured } from '@/config/api';
import type { ApiHealth } from '@/features/api-status/types/api-status';
import { fetchJson } from '@/utils/http';

/**
 * Estado da API e dos modelos de IA (CA-01).
 *
 * O `/health` responde 200 mesmo degradado — é a resposta que diz o que está
 * de pé: banco, Random Forest, câmera e emoção na voz.
 */
const HEALTH_PATH = '/health';

/** Curto: a tela inicial não pode ficar presa esperando um diagnóstico. */
const TIMEOUT_MS = 5_000;

export function isApiConfigured(): boolean {
  return isAtlasApiConfigured();
}

export function fetchHealth(signal?: AbortSignal): Promise<ApiHealth> {
  return fetchJson<ApiHealth>(atlasApiUrl(HEALTH_PATH), { timeoutMs: TIMEOUT_MS, signal });
}
