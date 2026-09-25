import type { Coordinate } from '@/features/map/types/coordinate';
import type { Decision, Emotion, ImageClass } from '@/features/trip-session/types/trip';

/**
 * Formato de `/v1/trips/{id}/recommendations`.
 *
 * - `check`: consulta periódica (o backend decide se é hora, RF-18).
 * - `manual`: "Atlas, preciso abastecer ou descansar" (sempre responde).
 * - `simulation`: modo de demonstração, com valores trocados.
 */
export type RecommendationTrigger = 'check' | 'manual' | 'simulation';

/** As 6 variáveis, todas opcionais: o que não vier fica com o valor real. */
export type SimulationOverrides = {
  hour?: number;
  tripMinutes?: number;
  distanceKm?: number;
  minutesSinceStop?: number;
  emotion?: Emotion | 'desconhecido';
  emotionConfidence?: number;
  image?: ImageClass | 'desconhecida';
};

export type RecommendationRequest = {
  trigger: RecommendationTrigger;
  distanceMeters: number;
  location?: Coordinate;
  simulation?: SimulationOverrides;
};

export type Contribution = {
  variable: string;
  label: string;
  value: string;
  /** Quanto a variável aumentou (ou diminuiu) a chance da decisão escolhida. */
  weight: number;
};

export type Recommendation = {
  id: string;
  eventId: string;
  decision: Decision;
  label: string;
  confidence: number;
  justification: string;
  contributions: Contribution[];
  probabilities: Record<Decision, number>;
  features: Record<string, number | string>;
  simulated: boolean;
  modelVersion: string;
  /** Tudo que não for CONTINUAR pede confirmação antes de mudar a rota. */
  requiresConfirmation: boolean;
};

export type RecommendationResponse = {
  evaluated: boolean;
  /** Vale a pena avisar o motorista: mostrar e falar. */
  notify: boolean;
  reason: string | null;
  /** Tensão forte na voz: oferecer a emergência em vez de recomendar. */
  assistance: boolean;
  recommendation: Recommendation | null;
};
