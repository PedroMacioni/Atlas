import type { Coordinate } from '@/features/map/types/coordinate';
import type {
  RecommendationRequest,
  RecommendationResponse,
} from '@/features/recommendation/types/recommendation';
import { tripApiRequest } from '@/features/trip-session/services/trip-session-service';
import { HttpError } from '@/utils/http';

/**
 * O Random Forest mora no backend (a "API local em Python" do escopo). Aqui
 * só se pergunta e se responde — nenhuma regra de decisão vive no aparelho.
 */

export function evaluateRecommendation(tripId: string, request: RecommendationRequest) {
  return tripApiRequest<RecommendationResponse>(`/${tripId}/recommendations`, {
    method: 'POST',
    body: request,
  });
}

export function answerRecommendation(
  tripId: string,
  recommendationId: string,
  accepted: boolean,
  location?: Coordinate | null,
) {
  return tripApiRequest<{ id: string; accepted: boolean }>(
    `/${tripId}/recommendations/${recommendationId}/answer`,
    { method: 'POST', body: { accepted, location: location ?? undefined } },
  );
}

export function describeRecommendationError(error: unknown): string {
  if (error instanceof HttpError) {
    switch (error.code) {
      case 'model_unavailable':
        return 'O modelo de recomendação não está disponível na API.';
      case 'simulation_disabled':
        return 'O modo de simulação está desligado na API.';
      case 'trip_already_finished':
        return 'Esta viagem já foi encerrada.';
    }

    if (error.kind === 'network' || error.kind === 'timeout') {
      return 'Sem conexão com a API do Atlas.';
    }
  }

  return 'Não foi possível consultar o Atlas agora.';
}
