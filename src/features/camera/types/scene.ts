import type { Coordinate } from '@/features/map/types/coordinate';
import type { ImageClass, TripPhoto } from '@/features/trip-session/types/trip';

/**
 * Para que a foto foi tirada — é o que decide se ela é guardada (RF-22).
 *
 * `context` é a leitura automática, que só vira classe para o Random Forest.
 * `tourist_spot` é o "Registrar ponto turístico", e essa foto fica.
 */
export type ScenePurpose = 'context' | 'tourist_spot';

/** O formato de `POST /v1/trips/{id}/scenes`. */
export type SceneResult = {
  imageClass: ImageClass;
  confidence: number;
  probabilities: Record<string, number>;
  /** `false` quando a leitura não virou evento — cena repetida ou incerta. */
  recorded: boolean;
  reason: string | null;
  eventId: string | null;
  photo: TripPhoto | null;
};

export type SendSceneParams = {
  tripId: string;
  /** Arquivo local devolvido pela câmera. */
  uri: string;
  purpose: ScenePurpose;
  location?: Coordinate | null;
  signal?: AbortSignal;
};
