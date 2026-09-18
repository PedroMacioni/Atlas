"""
Recomendações do Random Forest durante a viagem (RF-17, RF-18, RF-19).

O app chama `trigger: "check"` periodicamente e o backend decide se é hora —
a regra de "a cada 1 hora e a cada mudança relevante" mora aqui, onde está o
diário inteiro. `manual` é o pedido do usuário; `simulation` é o modo de
demonstração.
"""

from uuid import UUID

from fastapi import APIRouter

from app.core.dependencies import DeviceDep, RecommendationServiceDep
from app.schemas.recommendation import (
    RecommendationAnswer,
    RecommendationAnswerResponse,
    RecommendationRequest,
    RecommendationResponse,
)

router = APIRouter(prefix="/v1/trips/{trip_id}/recommendations", tags=["recomendações"])


@router.post("", response_model=RecommendationResponse)
async def evaluate(
    trip_id: UUID,
    payload: RecommendationRequest,
    device: DeviceDep,
    service: RecommendationServiceDep,
) -> RecommendationResponse:
    """Avalia a viagem agora e, se for o caso, recomenda — com justificativa."""
    return await service.evaluate(device, trip_id, payload)


@router.post("/{recommendation_id}/answer", response_model=RecommendationAnswerResponse)
async def answer(
    trip_id: UUID,
    recommendation_id: UUID,
    payload: RecommendationAnswer,
    device: DeviceDep,
    service: RecommendationServiceDep,
) -> RecommendationAnswerResponse:
    """Aceita ou recusa a recomendação. A rota só muda depois de aceita (CA-10)."""
    return await service.answer(device, trip_id, recommendation_id, payload)
