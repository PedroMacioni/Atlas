import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Viagens, diário de bordo e histórico: formato de `/v1/trips`.
 *
 * As listas de emoções, classes de imagem e decisões são as do escopo e as
 * mesmas do backend.
 */

export type Emotion = 'cansado' | 'neutro' | 'animado' | 'tenso' | 'bravo';

export type ImageClass = 'estrada' | 'posto' | 'restaurante' | 'ponto_turistico';

export type Decision =
  | 'continuar'
  | 'descansar'
  | 'abastecer'
  | 'alimentar'
  | 'registrar_ponto_turistico'
  | 'fazer_parada';

export type EventKind =
  | 'trip_started'
  | 'trip_ended'
  | 'stop'
  | 'command'
  | 'recommendation'
  | 'tourist_spot'
  | 'emergency'
  /** Leitura automática da câmera: vira classe, não vira foto guardada. */
  | 'scene';

/** As três formas de encerrar uma viagem (RF-25). */
export type EndReason = 'arrival' | 'button' | 'voice';

export type TripEvent = {
  id: string;
  kind: EventKind;
  occurredAt: string;
  location: Coordinate | null;
  command: string | null;
  emotion: Emotion | null;
  emotionConfidence: number | null;
  imageClass: ImageClass | null;
  imageConfidence: number | null;
  decision: Decision | null;
  justification: string | null;
};

export type TripStop = {
  id: string;
  position: number;
  name: string;
  category: string | null;
  reason: string | null;
  location: Coordinate;
  createdAt: string;
};

/** Uma foto guardada no diário (RF-22, CA-14). */
export type TripPhoto = {
  id: string;
  eventId: string;
  /** URL temporária, assinada pela API. Expira — vem junto da viagem. */
  url: string;
  imageClass: ImageClass | null;
  takenAt: string;
  location: Coordinate | null;
};

/** Card do histórico (RF-28). */
export type TripCard = {
  id: string;
  originName: string;
  destinationName: string;
  destination: Coordinate;
  startedAt: string;
  endedAt: string | null;
  endReason: EndReason | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  stopCount: number;
  predominantEmotion: Emotion | null;
};

/** Resumo final e detalhe do histórico (RF-26, RF-29). */
export type TripDetail = TripCard & {
  origin: Coordinate;
  path: Coordinate[];
  photos: TripPhoto[];
  stops: TripStop[];
  events: TripEvent[];
  longestStretchWithoutStopSeconds: number | null;
};
