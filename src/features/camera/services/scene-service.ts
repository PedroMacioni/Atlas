import { tripApiRequest } from '@/features/trip-session/services/trip-session-service';
import type { SceneResult, SendSceneParams } from '@/features/camera/types/scene';
import { HttpError } from '@/utils/http';

/**
 * Envia a foto para a API classificar (RF-16, CA-06).
 *
 * A imagem sobe como `multipart/form-data` porque é um arquivo: o `fetch` do
 * React Native monta o corpo a partir do `uri` local, sem o app precisar ler
 * os bytes nem convertê-los para base64 — que dobraria o tamanho do envio.
 *
 * O modelo roda no PC da equipe e leva um instante; o limite é generoso para
 * que uma foto de estrada não falhe por causa de meio segundo a mais.
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

  // O `fetch` do React Native aceita este formato de arquivo local.
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

/** Mensagem de tela para uma falha ao classificar. */
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
