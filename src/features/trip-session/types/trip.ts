import type { Coordinate } from '@/features/map/types/coordinate';

/**
 * Viagens, diário de bordo e histórico — o formato de `/v1/trips`.
 *
 * Os vocabulários da IA (emoção, classe de imagem, decisão) são os do escopo e
 * os mesmos do backend. Ainda não há modelo que os preencha; o tipo existe
 * para que a tela de resumo já saiba exibi-los quando houver.
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
  | 'emergency';

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
  stops: TripStop[];
  events: TripEvent[];
  longestStretchWithoutStopSeconds: number | null;
};
