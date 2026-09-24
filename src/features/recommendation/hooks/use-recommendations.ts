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
 * De quanto em quanto tempo o app pergunta "é hora?".
 *
 * Não é a cadência do modelo — essa é de 1 hora, e decidida no backend, junto
 * com as mudanças relevantes. Cinco minutos é o atraso máximo entre uma
 * mudança acontecer (uma leitura de cansaço, por exemplo) e o Atlas reagir.
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
   * "Atlas, preciso abastecer ou descansar" — sempre responde.
   *
   * Com `simulation`, as variáveis informadas substituem as reais e a
   * avaliação é registrada como simulação: é o que a viagem de demonstração
   * usa para perguntar "e se eu estivesse há uma hora na estrada?".
   */
  ask: (simulation?: SimulationOverrides) => void;
  /** Aceita ou recusa a recomendação atual. */
  answer: (accepted: boolean) => Promise<void>;
  dismissAssistance: () => void;
};

/**
 * Recomendações durante a viagem (RF-17 a RF-20).
 *
 * Consulta o backend periodicamente com `check`; quando ele diz que vale
 * interromper, a recomendação vira `current` — a tela mostra e fala. Nenhuma
 * decisão é tomada aqui — o modelo, a política de quando avaliar e o tempo de
 * espera moram na API, onde está o diário inteiro.
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

  // Falar a recomendação é da tela: é ela que sabe se, depois de falar, deve
  // ouvir a confirmação por voz — e as duas coisas não podem se sobrepor.
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

  // O intervalo é criado uma vez por viagem, mas cada tique precisa da
  // distância e da posição de agora: o ref guarda sempre o `evaluate` mais
  // recente, e é atualizado num efeito — nunca durante a renderização.
  const latestEvaluate = useRef(evaluate);

  useEffect(() => {
    latestEvaluate.current = evaluate;
  }, [evaluate]);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    const intervalId = setInterval(() => {
      // Falha silenciosa: uma consulta periódica perdida é só adiada para a
      // próxima. Quem precisa saber do erro é quem pediu (`ask`).
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
