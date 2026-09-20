import type { Coordinate } from '@/features/map/types/coordinate';
import type { Emotion } from '@/features/trip-session/types/trip';

/** O formato de `POST /v1/trips/{id}/voice`. */
export type VoiceCommandResult = {
  eventId: string;
  transcript: string | null;
  /** `null` quando não deu para ler a emoção — `reason` diz por quê. */
  emotion: Emotion | null;
  confidence: number | null;
  /** As três dimensões cruas do modelo, de 0 a 1 (§4.1). */
  arousal: number | null;
  valence: number | null;
  dominance: number | null;
  /** `no_audio`, `model_off`, `model_loading` ou `invalid_audio`. */
  reason: string | null;
};

export type SendVoiceCommandParams = {
  tripId: string;
  transcript: string;
  /** Arquivo gravado pelo reconhecimento de fala. Sem ele não há emoção. */
  audioUri?: string | null;
  location?: Coordinate | null;
};
