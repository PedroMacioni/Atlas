"""
Regras em volta do modelo: quando perguntar, o que perguntar e quando ficar
quieto.

O Random Forest responde "o que fazer agora". Estas funções respondem o
resto, olhando só o diário de bordo (dá para testar sem banco e sem modelo):

- montar as 6 variáveis a partir da viagem (`build_context`);
- quando avaliar (RF-18): a cada 1 hora ou quando algo importante muda
  (`evaluation_due`);
- quando avisar o motorista: confiança mínima, espera entre recomendações
  iguais, CONTINUAR em silêncio (`notification_policy`);
- emergência antes do modelo (§11): tensão forte na voz não passa pelo
  Random Forest (`needs_assistance`).
"""

from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.ml.features import TripContext

Row = dict[str, Any]


@dataclass(frozen=True)
class PolicySettings:
    # RF-18: "analisar o contexto a cada 1 hora".
    interval_minutes: float = 60
    # Leitura de voz ou câmera mais velha que isto vira "desconhecida".
    reading_max_age_minutes: float = 30
    # Abaixo desta confiança o Atlas não avisa (recomendação fraca atrapalha).
    min_confidence: float = 0.5
    # A mesma recomendação não se repete antes disto, aceita ou recusada.
    cooldown_minutes: float = 30
    # Tempo sem parar que, quando ultrapassado, dispara uma avaliação extra.
    stop_alert_minutes: float = 120
    # Tensão ou raiva com confiança acima disto vão para a emergência.
    assistance_confidence: float = 0.85
    timezone: str = "America/Sao_Paulo"


DEFAULT_POLICY = PolicySettings()

# Leituras que justificam uma avaliação fora de hora.
RELEVANT_EMOTIONS = {"cansado", "tenso", "bravo"}
RELEVANT_IMAGES = {"posto", "restaurante", "ponto_turistico"}


def _time(value: str | datetime) -> datetime:
    return value if isinstance(value, datetime) else datetime.fromisoformat(value)


def _minutes(delta: timedelta) -> float:
    return max(0.0, delta.total_seconds() / 60)


# Eventos que só copiam uma leitura que já estava no diário: não são leituras
# novas de voz ou câmera.
_COPIED_READINGS = {"recommendation", "emergency"}


def _readings(events: Sequence[Row], field: str) -> list[Row]:
    """Eventos com leitura de voz ou câmera (recomendações e emergências não contam)."""
    return [e for e in events if e.get(field) and e.get("kind") not in _COPIED_READINGS]


def last_stop_time(trip: Row, events: Sequence[Row]) -> datetime:
    stops = [_time(e["occurred_at"]) for e in events if e.get("kind") == "stop"]
    return max(stops) if stops else _time(trip["started_at"])


def latest_reading(
    events: Sequence[Row], field: str, now: datetime, max_age_minutes: float
) -> Row | None:
    """Leitura mais recente de `emotion` ou `image_class`, se ainda for atual."""
    readings = _readings(events, field)
    if not readings:
        return None

    latest = max(readings, key=lambda e: _time(e["occurred_at"]))
    age = _minutes(now - _time(latest["occurred_at"]))
    return latest if age <= max_age_minutes else None


def build_context(
    trip: Row,
    events: Sequence[Row],
    *,
    now: datetime,
    distance_km: float,
    policy: PolicySettings = DEFAULT_POLICY,
) -> TripContext:
    """
    Monta as 6 variáveis da viagem neste momento.

    Quase tudo vem do diário e do relógio. Só a distância percorrida vem do
    app, que soma o GPS.
    """
    local = now.astimezone(ZoneInfo(policy.timezone))
    emotion = latest_reading(events, "emotion", now, policy.reading_max_age_minutes)
    image = latest_reading(events, "image_class", now, policy.reading_max_age_minutes)

    return TripContext(
        hour=local.hour + local.minute / 60,
        trip_minutes=_minutes(now - _time(trip["started_at"])),
        distance_km=max(0.0, distance_km),
        image=image["image_class"] if image else "desconhecida",
        emotion=emotion["emotion"] if emotion else "desconhecido",
        minutes_since_stop=_minutes(now - last_stop_time(trip, events)),
    )


def apply_overrides(context: TripContext, overrides: dict[str, Any]) -> TripContext:
    """Simulação: troca as variáveis informadas e mantém as outras reais."""
    mapping = {
        "hour": "hour",
        "trip_minutes": "trip_minutes",
        "distance_km": "distance_km",
        "image": "image",
        "emotion": "emotion",
        "minutes_since_stop": "minutes_since_stop",
    }
    changes = {mapping[k]: v for k, v in overrides.items() if k in mapping and v is not None}
    simulated = replace(context, **changes)

    # Não pode estar sem parar há mais tempo do que está viajando.
    if simulated.minutes_since_stop > simulated.trip_minutes:
        simulated = replace(simulated, trip_minutes=simulated.minutes_since_stop)

    return simulated


def last_evaluation_time(
    trip: Row, recommendations: Sequence[Row], events: Sequence[Row] = ()
) -> datetime:
    """Quando foi a última avaliação real (ou o início da viagem, se não houve)."""
    real = [_time(r["created_at"]) for r in recommendations if not r.get("simulated")]
    # O alerta automático de tensão (evento `emergency` com a emoção gravada)
    # também conta como avaliação. Sem isso, a mesma leitura de voz faria o
    # alerta aparecer de novo a cada consulta do app (a cada 5 minutos).
    real += [
        _time(e["occurred_at"]) for e in events if e.get("kind") == "emergency" and e.get("emotion")
    ]
    return max(real) if real else _time(trip["started_at"])


def evaluation_due(
    trip: Row,
    events: Sequence[Row],
    recommendations: Sequence[Row],
    *,
    now: datetime,
    policy: PolicySettings = DEFAULT_POLICY,
) -> str | None:
    """
    Motivo para avaliar agora, ou `None` se ainda não é hora.

    O app pergunta de tempos em tempos e o backend decide, porque é ele que
    tem o diário inteiro. Os motivos, em ordem:

    1. passou 1 hora desde a última avaliação (ou desde a partida);
    2. chegou uma leitura de emoção importante (cansado, tenso, bravo);
    3. chegou uma leitura de imagem importante (posto, restaurante, ponto
       turístico);
    4. o tempo sem parar acabou de passar de 2 horas.
    """
    since = last_evaluation_time(trip, recommendations, events)

    if _minutes(now - since) >= policy.interval_minutes:
        return "Análise periódica (1 hora)"

    for event in _readings(events, "emotion"):
        if _time(event["occurred_at"]) > since and event["emotion"] in RELEVANT_EMOTIONS:
            return f"Mudança de contexto: emoção {event['emotion']}"

    for event in _readings(events, "image_class"):
        if _time(event["occurred_at"]) > since and event["image_class"] in RELEVANT_IMAGES:
            return f"Mudança de contexto: imagem {event['image_class']}"

    stop = last_stop_time(trip, events)
    limit = policy.stop_alert_minutes
    if _minutes(since - stop) < limit <= _minutes(now - stop):
        return f"Mudança de contexto: {int(limit)} min sem parada"

    return None


def needs_assistance(
    emotion: str, confidence: float | None, policy: PolicySettings = DEFAULT_POLICY
) -> bool:
    """Tensão ou raiva fortes pulam o modelo e oferecem a emergência (§11)."""
    return (
        emotion in ("tenso", "bravo")
        and confidence is not None
        and confidence >= policy.assistance_confidence
    )


def notification_policy(
    decision: str,
    confidence: float,
    recommendations: Sequence[Row],
    *,
    now: datetime,
    policy: PolicySettings = DEFAULT_POLICY,
) -> tuple[bool, bool, str | None]:
    """
    Para uma avaliação automática, decide `(gravar no diário, avisar, motivo)`.

    - Confiança baixa: não grava nem avisa.
    - Mesma recomendação há pouco tempo: não grava nem avisa.
    - CONTINUAR: grava (para o diário mostrar que avaliou), mas não interrompe.
    - O resto: grava e avisa.
    """
    if confidence < policy.min_confidence:
        return False, False, "low_confidence"

    for previous in recommendations:
        if previous.get("simulated") or previous.get("decision") != decision:
            continue
        if _minutes(now - _time(previous["created_at"])) < policy.cooldown_minutes:
            return False, False, "cooldown"

    if decision == "continuar":
        return True, False, None

    return True, True, None
