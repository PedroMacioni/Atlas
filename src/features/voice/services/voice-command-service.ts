import { tripApiRequest } from '@/features/trip-session/services/trip-session-service';
import { EMOTION_LABELS } from '@/features/trip-session/constants/journal-labels';
import type {
  SendVoiceCommandParams,
  VoiceCommandResult,
} from '@/features/voice/types/voice-command';

/**
 * Envia o comando falado para o diário junto com o áudio (RF-15, CA-07).
 *
 * O arquivo de áudio já existe: é o mesmo que o reconhecimento de fala gravou.
 * A emoção é analisada no backend, porque o modelo tem 1,2 GB.
 */
const TIMEOUT_MS = 30_000;

export function sendVoiceCommand({
  tripId,
  transcript,
  audioUri,
  location,
}: SendVoiceCommandParams): Promise<VoiceCommandResult> {
  const form = new FormData();
  form.append('transcript', transcript.slice(0, 200));

  if (audioUri) {
    const name = audioUri.split('/').pop() ?? 'comando.wav';
    form.append('audio', { uri: audioUri, name, type: guessType(name) } as unknown as Blob);
  }

  const params = new URLSearchParams();
  if (location) {
    params.set('latitude', String(location.latitude));
    params.set('longitude', String(location.longitude));
  }

  const query = params.toString();

  return tripApiRequest<VoiceCommandResult>(`/${tripId}/voice${query ? `?${query}` : ''}`, {
    method: 'POST',
    body: form,
    timeoutMs: TIMEOUT_MS,
  });
}

/** O Android grava WAV; o iOS grava CAF. */
function guessType(name: string): string {
  return name.toLowerCase().endsWith('.caf') ? 'audio/x-caf' : 'audio/wav';
}

/**
 * Aviso curto para a tela, ou `null` quando não há nada a dizer.
 *
 * Emoção neutra ou leitura fraca (confiança abaixo de 0,5) não geram aviso,
 * para não distrair o motorista à toa.
 */
export function describeEmotion(result: VoiceCommandResult): string | null {
  if (!result.emotion || result.emotion === 'neutro') {
    return null;
  }

  if ((result.confidence ?? 0) < 0.5) {
    return null;
  }

  return `Ouvi sua voz ${EMOTION_LABELS[result.emotion].toLowerCase()}.`;
}
