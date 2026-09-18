"""
Random Forest de recomendação: o modelo, a explicação, a política e a API.

Usa o modelo versionado em `ml/models/` — o mesmo que a API carrega. Se ele
for retreinado, estes testes continuam valendo: afirmam comportamento do
escopo (o exemplo de §4.5 dá DESCANSAR), não números exatos.
"""

from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from app.core.config import get_settings
from app.ml.explanation import explain, format_minutes
from app.ml.features import FEATURE_NAMES, TripContext, encode
from app.ml.model import DecisionModel, path_contributions
from app.ml.policy import (
    apply_overrides,
    build_context,
    evaluation_due,
    needs_assistance,
    notification_policy,
)
from tests.test_trips import DEVICE, START, FakeTripRepository

SCOPE_EXAMPLE = TripContext(
    hour=15.0,
    trip_minutes=160,
    distance_km=190,
    image="estrada",
    emotion="cansado",
    minutes_since_stop=130,
)


@pytest.fixture(scope="module")
def model() -> DecisionModel:
    loaded = DecisionModel.load(get_settings().ml_model_path)
    assert loaded is not None, "Modelo ausente: rode `uv run python -m ml.train`."
    return loaded


# --- Modelo e explicação ---------------------------------------------------


def test_exemplo_do_escopo_recomenda_descansar(model):
    prediction = model.predict(SCOPE_EXAMPLE)

    assert prediction.decision == "descansar"
    assert prediction.confidence > 0.6


def test_contribuicoes_somam_exatamente_a_probabilidade(model):
    """Base + Σ contribuições = predict_proba — o método de Saabas é exato."""
    forest = model._forest
    rng = np.random.default_rng(7)

    for _ in range(5):
        context = TripContext(
            hour=float(rng.uniform(0, 24)),
            trip_minutes=float(rng.uniform(0, 400)),
            distance_km=float(rng.uniform(0, 500)),
            image="posto",
            emotion="neutro",
            minutes_since_stop=float(rng.uniform(0, 200)),
        )
        row = np.array(encode(context))
        base, contributions = path_contributions(forest, row)

        expected = forest.predict_proba(row.reshape(1, -1))[0]
        assert np.allclose(base + contributions.sum(axis=0), expected)

    assert len(row) == len(FEATURE_NAMES)


def test_justificativa_cita_os_motivos_reais(model):
    prediction = model.predict(SCOPE_EXAMPLE)
    text = explain(prediction.decision, prediction.contributions, SCOPE_EXAMPLE)

    assert text.startswith("Recomendação: DESCANSAR. Motivo: ")
    assert "cansado" in text


def test_justificativa_nao_cita_variavel_sem_peso():
    contributions = {"emocao": 0.5, "tempo_sem_parada": 0.001, "horario": -0.2}
    text = explain("descansar", contributions, SCOPE_EXAMPLE)

    assert text == "Recomendação: DESCANSAR. Motivo: você parece cansado."


def test_inicio_de_viagem_nao_vira_zero_minutos():
    start = TripContext(
        hour=9,
        trip_minutes=0,
        distance_km=0,
        image="desconhecida",
        emotion="desconhecido",
        minutes_since_stop=0,
    )
    text = explain("continuar", {"tempo_sem_parada": 0.3, "tempo_viagem": 0.2}, start)

    assert text == "Recomendação: CONTINUAR. Motivo: a viagem acabou de começar."


def test_formato_de_duracao():
    assert format_minutes(45) == "45 min"
    assert format_minutes(160) == "2h40"
    assert format_minutes(120) == "2h"


# --- Política --------------------------------------------------------------

T0 = datetime(2026, 9, 18, 15, 0, tzinfo=UTC)  # 12h00 em Brasília
TRIP = {"id": "t", "started_at": T0.isoformat()}


def _event(kind: str, minutes: float, **fields) -> dict:
    return {"kind": kind, "occurred_at": (T0 + timedelta(minutes=minutes)).isoformat(), **fields}


def test_contexto_vem_do_diario_e_do_relogio():
    events = [
        _event("stop", 30),
        _event("command", 70, emotion="cansado"),
        _event("tourist_spot", 10, image_class="ponto_turistico"),  # velha demais
    ]
    context = build_context(TRIP, events, now=T0 + timedelta(minutes=80), distance_km=95)

    assert context.hour == pytest.approx(13 + 20 / 60)  # fuso de Brasília
    assert context.trip_minutes == pytest.approx(80)
    assert context.minutes_since_stop == pytest.approx(50)
    assert context.emotion == "cansado"
    assert context.image == "desconhecida"


def test_simulacao_mantem_consistencia():
    simulated = apply_overrides(SCOPE_EXAMPLE, {"minutes_since_stop": 300})

    assert simulated.trip_minutes == 300
    assert simulated.emotion == "cansado"


def test_avaliacao_periodica_a_cada_hora():
    assert evaluation_due(TRIP, [], [], now=T0 + timedelta(minutes=30)) is None
    assert evaluation_due(TRIP, [], [], now=T0 + timedelta(minutes=61)) is not None


def test_mudanca_relevante_antecipa_a_avaliacao():
    events = [_event("command", 20, emotion="cansado")]
    assert "cansado" in evaluation_due(TRIP, events, [], now=T0 + timedelta(minutes=25))

    calm = [_event("command", 20, emotion="animado")]
    assert evaluation_due(TRIP, calm, [], now=T0 + timedelta(minutes=25)) is None


def test_cruzar_duas_horas_sem_parada_dispara():
    last_eval = [{"created_at": (T0 + timedelta(minutes=100)).isoformat(), "decision": "x"}]
    due = evaluation_due(TRIP, [], last_eval, now=T0 + timedelta(minutes=121))
    assert due is not None and "sem parada" in due


def test_politica_de_aviso():
    now = T0 + timedelta(hours=2)
    recent = [{"decision": "descansar", "created_at": (now - timedelta(minutes=10)).isoformat()}]

    assert notification_policy("descansar", 0.4, [], now=now) == (False, False, "low_confidence")
    assert notification_policy("descansar", 0.9, recent, now=now) == (False, False, "cooldown")
    assert notification_policy("continuar", 0.9, [], now=now) == (True, False, None)
    assert notification_policy("abastecer", 0.9, recent, now=now) == (True, True, None)


def test_tensao_forte_vai_para_a_assistencia():
    assert needs_assistance("tenso", 0.9)
    assert not needs_assistance("tenso", 0.6)
    assert not needs_assistance("cansado", 0.99)


# --- API -------------------------------------------------------------------


@pytest.fixture
def api_with_clock(database, model):
    """API com repositório em memória e um relógio que o teste adianta."""
    from fastapi.testclient import TestClient

    from app.core.dependencies import get_recommendation_service, get_trip_repository
    from app.main import create_app
    from app.services.recommendation_service import RecommendationService

    repository = FakeTripRepository()
    offset = {"minutes": 0}

    def clock():
        return datetime.now(UTC) + timedelta(minutes=offset["minutes"])

    app = create_app()
    app.dependency_overrides[get_trip_repository] = lambda: repository
    app.dependency_overrides[get_recommendation_service] = lambda: RecommendationService(
        repository, model, simulation_enabled=True, clock=clock
    )

    with TestClient(app, headers={"X-Atlas-Device": DEVICE}) as client:
        app.state.database = database
        yield client, offset, repository


def _start(client) -> str:
    return client.post("/v1/trips", json=START).json()["id"]


def test_simulacao_do_cenario_3_recomenda_descansar_com_justificativa(api_with_clock):
    client, _, repository = api_with_clock
    trip_id = _start(client)

    body = client.post(
        f"/v1/trips/{trip_id}/recommendations",
        json={
            "trigger": "simulation",
            "distanceMeters": 0,
            "simulation": {
                "tripMinutes": 160,
                "minutesSinceStop": 130,
                "emotion": "cansado",
                "distanceKm": 190,
                "image": "estrada",
                "hour": 15,
            },
        },
    ).json()

    recommendation = body["recommendation"]
    assert body["notify"] is True
    assert recommendation["decision"] == "descansar"
    assert recommendation["requiresConfirmation"] is True
    assert recommendation["simulated"] is True
    assert "Motivo:" in recommendation["justification"]
    assert len(recommendation["contributions"]) == 6

    # Foi para o diário, marcada como simulação.
    event = next(e for e in repository.events if e["kind"] == "recommendation")
    assert event["decision"] == "descansar"
    assert event["justification"].endswith("(simulação)")


def test_consulta_periodica_espera_a_hora(api_with_clock):
    client, offset, _ = api_with_clock
    trip_id = _start(client)
    url = f"/v1/trips/{trip_id}/recommendations"

    early = client.post(url, json={"trigger": "check", "distanceMeters": 1_000}).json()
    assert early == {
        "evaluated": False,
        "notify": False,
        "reason": "not_due",
        "assistance": False,
        "recommendation": None,
    }

    offset["minutes"] = 61
    later = client.post(url, json={"trigger": "check", "distanceMeters": 60_000}).json()
    assert later["evaluated"] is True


def test_pedido_do_usuario_sempre_responde(api_with_clock):
    client, _, _ = api_with_clock
    trip_id = _start(client)

    body = client.post(
        f"/v1/trips/{trip_id}/recommendations",
        json={"trigger": "manual", "distanceMeters": 500},
    ).json()

    assert body["evaluated"] is True
    assert body["recommendation"] is not None


def test_tensao_forte_oferece_emergencia_em_vez_de_recomendar(api_with_clock):
    client, _, repository = api_with_clock
    trip_id = _start(client)

    body = client.post(
        f"/v1/trips/{trip_id}/recommendations",
        json={
            "trigger": "simulation",
            "distanceMeters": 0,
            "simulation": {"emotion": "tenso", "emotionConfidence": 0.95},
        },
    ).json()

    assert body["assistance"] is True
    assert body["recommendation"] is None
    assert any(e["kind"] == "emergency" for e in repository.events)


def test_aceitar_recomendacao_fica_registrado(api_with_clock):
    client, _, repository = api_with_clock
    trip_id = _start(client)
    recommendation = client.post(
        f"/v1/trips/{trip_id}/recommendations",
        json={"trigger": "manual", "distanceMeters": 500},
    ).json()["recommendation"]

    answer = client.post(
        f"/v1/trips/{trip_id}/recommendations/{recommendation['id']}/answer",
        json={"accepted": True},
    )

    assert answer.status_code == 200
    assert answer.json()["accepted"] is True
    assert repository.recommendations[0]["accepted"] is True
    assert repository.events[-1]["command"].startswith("Recomendação aceita")


def test_simulacao_so_com_trigger_de_simulacao(api_with_clock):
    client, _, _ = api_with_clock
    trip_id = _start(client)

    response = client.post(
        f"/v1/trips/{trip_id}/recommendations",
        json={"trigger": "check", "distanceMeters": 0, "simulation": {"hour": 3}},
    )
    assert response.status_code == 422


def test_sem_modelo_responde_503(database):
    from fastapi.testclient import TestClient

    from app.core.dependencies import get_decision_model, get_trip_repository
    from app.main import create_app

    repository = FakeTripRepository()
    app = create_app()
    app.dependency_overrides[get_trip_repository] = lambda: repository
    app.dependency_overrides[get_decision_model] = lambda: None

    with TestClient(app, headers={"X-Atlas-Device": DEVICE}) as client:
        app.state.database = database
        trip_id = client.post("/v1/trips", json=START).json()["id"]
        response = client.post(
            f"/v1/trips/{trip_id}/recommendations",
            json={"trigger": "manual", "distanceMeters": 0},
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "model_unavailable"
