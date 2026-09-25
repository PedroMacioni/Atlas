import { useCallback, useEffect, useRef, useState } from 'react';

import type { Coordinate } from '@/features/map/types/coordinate';
import {
  answerRecommendation,
  describeRecommendationError,
  evaluateRecommendation,
} from '@/features/recommendation/services/recommendation-service';
import type {
  Recommendation,
  RecommendationResponse,
  RecommendationTrigger,
  SimulationOverrides,
} from '@/features/recommendation/types/recommendation';

/**
 * De quanto em quanto tempo o app pergunta "é hora de avaliar?".
 *
 * Quem decide a avaliação (a cada 1 hora ou quando algo muda) é o backend.
 * Cinco minutos é o atraso máximo para o Atlas reagir a uma mudança.
 */
const CHECK_INTERVAL_MS = 5 * 60 * 1_000;

export type UseRecommendationsParams = {
  /** `null` enquanto a viagem não está registrada: nada é consultado. */
  tripId: string | null;
  traveledMeters: number;
  location: Coordinate | null;
};

export type RecommendationsState = {
  /** A recomendação na tela, esperando resposta. */
  current: Recommendation | null;
  /** Tensão forte detectada: a tela deve oferecer a emergência. */
  assistance: boolean;
  isAsking: boolean;
  error: string | null;
  /**
   * "Atlas, preciso abastecer ou descansar": sempre responde.
   *
   * Com `simulation`, os valores informados substituem os reais (usado na
   * viagem de demonstração).
   */
  ask: (simulation?: SimulationOverrides) => void;
  /** Aceita ou recusa a recomendação atual. */
  answer: (accepted: boolean) => Promise<void>;
  dismissAssistance: () => void;
};

/**
 * Recomendações durante a viagem (RF-17 a RF-20).
 *
 * Pergunta ao backend de tempos em tempos (`check`). Quando ele diz que vale
 * avisar, a recomendação vira `current` e a tela mostra e fala. Nenhuma
 * decisão é tomada no app: modelo e regras ficam na API.
 */
export function useRecommendations({
  tripId,
  traveledMeters,
  location,
}: UseRecommendationsParams): RecommendationsState {
  const [current, setCurrent] = useState<Recommendation | null>(null);
  const [assistance, setAssistance] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Falar a recomendação é papel da tela (ela sabe se depois deve ouvir a resposta).
  const handle = useCallback((response: RecommendationResponse) => {
    if (response.assistance) {
      setAssistance(true);
      return;
    }

    if (response.notify && response.recommendation) {
      setCurrent(response.recommendation);
    }
  }, []);

  const evaluate = useCallback(
    async (trigger: RecommendationTrigger, simulation?: SimulationOverrides) => {
      if (!tripId) {
        return;
      }

      const response = await evaluateRecommendation(tripId, {
        trigger,
        distanceMeters: traveledMeters,
        location: location ?? undefined,
        simulation,
      });
      handle(response);
    },
    [tripId, traveledMeters, location, handle],
  );

  // O intervalo é criado uma vez por viagem, mas cada consulta precisa da
  // distância e posição atuais. O ref guarda sempre o `evaluate` mais recente.
  const latestEvaluate = useRef(evaluate);

  useEffect(() => {
    latestEvaluate.current = evaluate;
  }, [evaluate]);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    const intervalId = setInterval(() => {
      // Se uma consulta periódica falhar, tenta de novo na próxima.
      latestEvaluate.current('check').catch(() => {});
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [tripId]);

  const ask = useCallback(
    (simulation?: SimulationOverrides) => {
    setIsAsking(true);
    setError(null);

    evaluate(simulation ? 'simulation' : 'manual', simulation)
      .catch((cause: unknown) => setError(describeRecommendationError(cause)))
      .finally(() => setIsAsking(false));
    },
    [evaluate],
  );

  const answer = useCallback(
    async (accepted: boolean) => {
      if (!tripId || !current) {
        return;
      }

      const answered = current;
      setCurrent(null);

      try {
        await answerRecommendation(tripId, answered.id, accepted, location);
      } catch (cause) {
        setError(describeRecommendationError(cause));
      }
    },
    [tripId, current, location],
  );

  const dismissAssistance = useCallback(() => setAssistance(false), []);

  return { current, assistance, isAsking, error, ask, answer, dismissAssistance };
}
