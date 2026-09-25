import { tripApiRequest } from '@/features/trip-session/services/trip-session-service';
import type { SceneResult, SendSceneParams } from '@/features/camera/types/scene';
import { HttpError } from '@/utils/http';

/**
 * Envia a foto para a API classificar (RF-16, CA-06).
 *
 * A foto vai como `multipart/form-data`: o `fetch` monta o corpo a partir do
 * arquivo local, sem converter para base64 (que dobraria o tamanho).
 *
 * O tempo limite é longo porque o modelo roda num computador comum.
 */
const TIMEOUT_MS = 30_000;

export function sendScene({
  tripId,
  uri,
  purpose,
  location,
  signal,
}: SendSceneParams): Promise<SceneResult> {
  const form = new FormData();

  // Formato de arquivo local aceito pelo `fetch` do React Native.
  form.append('image', {
    uri,
    name: 'cena.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('purpose', purpose);

  const params = new URLSearchParams();
  if (location) {
    params.set('latitude', String(location.latitude));
    params.set('longitude', String(location.longitude));
  }

  const query = params.toString();

  return tripApiRequest<SceneResult>(`/${tripId}/scenes${query ? `?${query}` : ''}`, {
    method: 'POST',
    body: form,
    timeoutMs: TIMEOUT_MS,
  });
}

/** Mensagem para a tela quando a classificação falha. */
export function describeSceneError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.code === 'vision_unavailable') {
      return 'A IA de imagem ainda está carregando no servidor.';
    }
    if (error.code === 'invalid_image') {
      return 'A foto não pôde ser lida.';
    }
    if (error.kind === 'timeout') {
      return 'A classificação da foto demorou demais.';
    }
    if (error.kind === 'network') {
      return 'Sem conexão com a API do Atlas.';
    }
  }
  return 'Não foi possível classificar a foto.';
}
