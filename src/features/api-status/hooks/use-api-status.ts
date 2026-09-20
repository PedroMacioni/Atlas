import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchHealth, isApiConfigured } from '@/features/api-status/services/api-status-service';
import type { ApiHealth } from '@/features/api-status/types/api-status';

export type ApiStatus = {
  /** `false` sem `EXPO_PUBLIC_ATLAS_API_URL` — não há IA para conectar. */
  configured: boolean;
  isLoading: boolean;
  health: ApiHealth | null;
  /** `true` quando a API respondeu, mesmo que degradada. */
  online: boolean;
  /** Frase curta para a pílula da tela inicial. */
  summary: string;
};

/**
 * "Conexão com a IA" da tela de abertura (CA-01).
 *
 * Consulta a cada foco da tela, e não em intervalo: quem volta para a tela
 * inicial depois de ligar o backend vê a mudança sem reabrir o aplicativo.
 */
export function useApiStatus(): ApiStatus {
  const configured = isApiConfigured();
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [isLoading, setIsLoading] = useState(configured);

  useFocusEffect(
    useCallback(() => {
      if (!configured) {
        return;
      }

      const controller = new AbortController();
      setIsLoading(true);

      fetchHealth(controller.signal)
        .then(setHealth)
        .catch(() => setHealth(null))
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });

      return () => controller.abort();
    }, [configured]),
  );

  return {
    configured,
    isLoading,
    health,
    online: health !== null,
    summary: describe(configured, isLoading, health),
  };
}

/** O que a pílula diz embaixo do título. */
function describe(configured: boolean, isLoading: boolean, health: ApiHealth | null): string {
  if (!configured) {
    return 'Configure EXPO_PUBLIC_ATLAS_API_URL';
  }
  if (isLoading && !health) {
    return 'Conectando…';
  }
  if (!health) {
    return 'A API não respondeu';
  }

  const parts = [
    health.model ? 'decisão' : null,
    health.vision === 'ready' ? 'imagem' : health.vision === 'loading' ? 'imagem (abrindo)' : null,
    health.voiceEmotion === 'ready'
      ? 'emoção'
      : health.voiceEmotion === 'loading'
        ? 'emoção (abrindo)'
        : null,
  ].filter(Boolean);

  return parts.length > 0 ? `Modelos: ${parts.join(', ')}` : 'Sem modelos carregados';
}
