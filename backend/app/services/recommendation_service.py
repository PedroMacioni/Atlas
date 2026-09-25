"""
Recomendações durante a viagem: liga o Random Forest ao diário de bordo.

Caminho de uma avaliação:

    diário + relógio + distância do app
        → monta as 6 variáveis        (ml/policy.build_context)
        → já é hora de avaliar?       (ml/policy.evaluation_due)
        → tensão forte? emergência    (ml/policy.needs_assistance)
        → Random Forest + explicação  (ml/model, ml/explanation)
        → vale avisar o motorista?    (ml/policy.notification_policy)
        → grava o evento no diário e a linha em `recommendations`
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.core.errors import ModelUnavailable, RecommendationNotFound, SimulationDisabled
from app.ml.explanation import DECISION_LABELS, explain, format_minutes
from app.ml.features import TripContext
from app.ml.model import DecisionModel
from app.ml.policy import (
    DEFAULT_POLICY,
    PolicySettings,
    apply_overrides,
    build_context,
    evaluation_due,
    latest_reading,
    needs_assistance,
    notification_policy,
)
from app.repositories.trip_repository import TripRepository
from app.schemas.recommendation import (
    Contribution,
    Recommendation,
    RecommendationAnswer,
    RecommendationAnswerResponse,
    RecommendationRequest,
    RecommendationResponse,
)
from app.services.trip_service import TripService

VARIABLE_LABELS = {
    "horario": "Horário do dia",
    "tempo_viagem": "Tempo de viagem",
    "distancia": "Distância percorrida",
    "imagem": "Classe da imagem",
    "emocao": "Estado emocional",
    "tempo_sem_parada": "Tempo desde a última parada",
}

TRIGGER_COMMANDS = {
    "manual": "Atlas, preciso abastecer ou descansar",
    "simulation": "Simulação (modo de demonstração)",
}


def describe_value(variable: str, context: TripContext) -> str:
    match variable:
        case "horario":
            hours = int(context.hour)
            return f"{hours:02d}h{round((context.hour - hours) * 60) % 60:02d}"
        case "tempo_viagem":
            return format_minutes(context.trip_minutes)
        case "distancia":
            return f"{context.distance_km:.0f} km"
        case "imagem":
            return context.image.replace("_", " ")
        case "emocao":
            return context.emotion
        case "tempo_sem_parada":
            return format_minutes(context.minutes_since_stop)
    return ""


class RecommendationService:
    def __init__(
        self,
        repository: TripRepository,
        model: DecisionModel | None,
        *,
        simulation_enabled: bool,
        policy: PolicySettings = DEFAULT_POLICY,
        clock=lambda: datetime.now(UTC),
    ) -> None:
        self._repository = repository
        self._trips = TripService(repository)
        self._model = model
        self._simulation_enabled = simulation_enabled
        self._policy = policy
        self._clock = clock

    async def evaluate(
        self, device: UUID, trip_id: UUID, request: RecommendationRequest
    ) -> RecommendationResponse:
        if self._model is None:
            raise ModelUnavailable(
                "O modelo de recomendação não está disponível — rode ml/train.py."
            )
        if request.trigger == "simulation" and not self._simulation_enabled:
            raise SimulationDisabled("O modo de simulação está desligado nesta API.")

        _, trip = await self._trips.open_trip(device, trip_id)
        events = await self._repository.list_events(trip["id"])
        history = await self._repository.list_recommendations(trip["id"])
        now = self._clock()

        context = build_context(
            trip, events, now=now, distance_km=request.distance_meters / 1000, policy=self._policy
        )

        emotion_reading = latest_reading(
            events, "emotion", now, self._policy.reading_max_age_minutes
        )
        emotion_confidence = emotion_reading.get("emotion_confidence") if emotion_reading else None

        simulated = request.trigger == "simulation"
        if simulated and request.simulation:
            overrides = request.simulation.model_dump(
                mode="json", by_alias=False, exclude_none=True
            )
            context = apply_overrides(context, overrides)
            emotion_confidence = overrides.get("emotion_confidence", emotion_confidence)

        # 1. Já é hora? Só a consulta periódica pode receber "ainda não".
        cause = None
        if request.trigger == "check":
            cause = evaluation_due(trip, events, history, now=now, policy=self._policy)
            if cause is None:
                return RecommendationResponse(evaluated=False, notify=False, reason="not_due")

        # 2. Emergência vem antes do modelo.
        if needs_assistance(context.emotion, emotion_confidence, self._policy):
            await self._repository.add_event(
                {
                    "trip_id": trip["id"],
                    "kind": "emergency",
                    "occurred_at": now.isoformat(),
                    **_location(request),
                    "command": "Assistência sugerida: tensão forte na voz"
                    + (" (simulação)" if simulated else ""),
                    # Na simulação a emoção é inventada. Gravar aqui faria ela contar
                    # como leitura real de voz nas próximas avaliações.
                    "emotion": None if simulated else context.emotion,
                    "emotion_confidence": None if simulated else emotion_confidence,
                }
            )
            return RecommendationResponse(
                evaluated=True, notify=True, assistance=True, reason="assistance"
            )

        # 3. Pergunta ao modelo.
        prediction = self._model.predict(context)
        justification = explain(prediction.decision, prediction.contributions, context)

        # 4. Avisar ou não? Pedido do usuário e simulação sempre respondem.
        record, notify, reason = True, True, None
        if request.trigger == "check":
            record, notify, reason = notification_policy(
                prediction.decision, prediction.confidence, history, now=now, policy=self._policy
            )

        if not record:
            return RecommendationResponse(evaluated=True, notify=False, reason=reason)

        # 5. Grava no diário e na tabela de recomendações.
        event = await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": "recommendation",
                "occurred_at": now.isoformat(),
                **_location(request),
                "command": TRIGGER_COMMANDS.get(request.trigger, cause),
                "emotion": context.emotion if context.emotion != "desconhecido" else None,
                "emotion_confidence": emotion_confidence,
                "image_class": context.image if context.image != "desconhecida" else None,
                "decision": prediction.decision,
                "justification": f"{justification} (simulação)" if simulated else justification,
            }
        )

        row = await self._repository.add_recommendation(
            {
                "trip_event_id": event["id"],
                "decision": prediction.decision,
                "confidence": round(prediction.confidence, 4),
                "features": context.as_dict(),
                "probabilities": prediction.probabilities,
                "trigger": request.trigger,
                "simulated": simulated,
                "model_version": self._model.version,
            }
        )

        contributions = [
            Contribution(
                variable=name,
                label=VARIABLE_LABELS[name],
                value=describe_value(name, context),
                weight=weight,
            )
            for name, weight in sorted(
                prediction.contributions.items(), key=lambda item: item[1], reverse=True
            )
        ]

        return RecommendationResponse(
            evaluated=True,
            notify=notify,
            reason=reason,
            recommendation=Recommendation(
                id=row["id"],
                event_id=event["id"],
                decision=prediction.decision,
                label=DECISION_LABELS[prediction.decision],
                confidence=prediction.confidence,
                justification=justification,
                contributions=contributions,
                probabilities=prediction.probabilities,
                features=context.as_dict(),
                simulated=simulated,
                model_version=self._model.version,
                requires_confirmation=prediction.decision != "continuar",
            ),
        )

    async def answer(
        self, device: UUID, trip_id: UUID, recommendation_id: UUID, answer: RecommendationAnswer
    ) -> RecommendationAnswerResponse:
        """Aceita ou recusa (CA-10). A resposta vira rótulo real para o dataset (§4.6)."""
        _, trip = await self._trips.open_trip(device, trip_id)
        now = self._clock()

        # Já respondida antes: devolve a resposta que valeu, sem gravar outro
        # evento no diário (que poderia dizer o contrário da primeira resposta).
        history = await self._repository.list_recommendations(trip["id"])
        known = next((r for r in history if str(r["id"]) == str(recommendation_id)), None)
        if known is not None and known.get("accepted") is not None:
            return RecommendationAnswerResponse(id=known["id"], accepted=bool(known["accepted"]))

        row = await self._repository.respond_recommendation(
            trip["id"],
            recommendation_id,
            {"accepted": answer.accepted, "responded_at": now.isoformat()},
        )
        if row is None:
            raise RecommendationNotFound("Recomendação não encontrada nesta viagem.")

        label = DECISION_LABELS.get(row.get("decision", ""), "")
        await self._repository.add_event(
            {
                "trip_id": trip["id"],
                "kind": "command",
                "occurred_at": now.isoformat(),
                "latitude": answer.location.latitude if answer.location else None,
                "longitude": answer.location.longitude if answer.location else None,
                "command": f"Recomendação {'aceita' if answer.accepted else 'recusada'}: {label}",
            }
        )

        return RecommendationAnswerResponse(id=row["id"], accepted=bool(row.get("accepted")))


def _location(request: RecommendationRequest) -> dict[str, Any]:
    if request.location is None:
        return {"latitude": None, "longitude": None}
    return {"latitude": request.location.latitude, "longitude": request.location.longitude}
