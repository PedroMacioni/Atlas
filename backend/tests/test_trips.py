"""
Viagens, diário de bordo e histórico — de ponta a ponta, com o repositório em
memória no lugar do Supabase.

O que importa aqui é o fluxo do escopo: abrir, registrar, encerrar, e depois
achar a mesma viagem no histórico — e só no histórico do aparelho dono dela.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.services.trip_service import longest_stretch_seconds, predominant_emotion

DEVICE = "8f14e45f-ceea-467a-9575-6a8b7c1e2d3f"
OTHER_DEVICE = "0b7e5a3c-1d2f-4a6b-8c9d-0e1f2a3b4c5d"

START = {
    "origin": {"name": "Sua localização", "latitude": -22.9056, "longitude": -47.0608},
    "destination": {"name": "Faculdade Anhanguera", "latitude": -22.8616, "longitude": -47.0452},
}


class FakeTripRepository:
    """Dublê do `TripRepository`: as mesmas regras de dono, em dicionários."""

    def __init__(self) -> None:
        self.devices: dict[str, UUID] = {}
        self.trips: dict[str, dict[str, Any]] = {}
        self.events: list[dict[str, Any]] = []
        self.stops: list[dict[str, Any]] = []

    async def ensure_device(self, anonymous_uuid: UUID) -> UUID:
        return self.devices.setdefault(str(anonymous_uuid), uuid4())

    async def create_trip(self, row):
        stored = {**row, "id": str(uuid4()), "ended_at": None, "end_reason": None, "path": []}
        self.trips[stored["id"]] = stored
        return stored

    async def get_trip(self, device_id, trip_id, *, with_path=False):
        trip = self.trips.get(str(trip_id))
        return trip if trip and trip["device_id"] == str(device_id) else None

    async def list_trips(self, device_id, *, limit):
        mine = [t for t in self.trips.values() if t["device_id"] == str(device_id)]
        mine.sort(key=lambda t: t["started_at"], reverse=True)
        return [
            {**t, "stops": [{"count": sum(s["trip_id"] == t["id"] for s in self.stops)}]}
            for t in mine[:limit]
        ]

    async def finish_trip(self, device_id, trip_id, values):
        trip = await self.get_trip(device_id, trip_id)
        if trip is None or trip["ended_at"]:
            return None
        trip.update(values)
        return trip

    async def add_event(self, row):
        stored = {**row, "id": str(uuid4())}
        self.events.append(stored)
        return stored

    async def list_events(self, trip_id):
        return sorted(
            (e for e in self.events if e["trip_id"] == str(trip_id)),
            key=lambda e: e["occurred_at"],
        )

    async def add_stop(self, row):
        stored = {**row, "id": str(uuid4()), "created_at": datetime.now(UTC).isoformat()}
        self.stops.append(stored)
        return stored

    async def list_stops(self, trip_id):
        return [s for s in self.stops if s["trip_id"] == str(trip_id)]

    # --- recomendações ---

    recommendations: list[dict[str, Any]]

    async def add_recommendation(self, row):
        self.__dict__.setdefault("recommendations", [])
        stored = {
            **row,
            "id": str(uuid4()),
            "accepted": None,
            "created_at": datetime.now(UTC).isoformat(),
        }
        self.recommendations.append(stored)
        return stored

    async def list_recommendations(self, trip_id):
        events = {e["id"] for e in self.events if e["trip_id"] == str(trip_id)}
        return [r for r in self.__dict__.get("recommendations", []) if r["trip_event_id"] in events]

    async def respond_recommendation(self, trip_id, recommendation_id, values):
        for row in await self.list_recommendations(trip_id):
            if row["id"] == str(recommendation_id):
                if row["accepted"] is None:
                    row.update(values)
                return row
        return None


@pytest.fixture
def repository() -> FakeTripRepository:
    return FakeTripRepository()


@pytest.fixture
def api(repository: FakeTripRepository, database):
    from fastapi.testclient import TestClient

    from app.core.dependencies import get_trip_repository
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_trip_repository] = lambda: repository

    with TestClient(app, headers={"X-Atlas-Device": DEVICE}) as test_client:
        app.state.database = database
        yield test_client


def _start(api) -> dict:
    response = api.post("/v1/trips", json=START)
    assert response.status_code == 201
    return response.json()


# --- Fluxo -----------------------------------------------------------------


def test_abrir_viagem_devolve_o_contrato_e_registra_o_inicio(api):
    trip = _start(api)

    assert trip["destinationName"] == "Faculdade Anhanguera"
    assert trip["endedAt"] is None
    assert trip["events"][0]["kind"] == "trip_started"
    assert trip["events"][0]["command"] == "Destino: Faculdade Anhanguera"


def test_fluxo_completo_parada_emergencia_encerramento_e_historico(api):
    trip = _start(api)
    trip_id = trip["id"]

    stop = api.post(
        f"/v1/trips/{trip_id}/stops",
        json={"location": {"latitude": -22.88, "longitude": -47.05}},
    )
    assert stop.status_code == 201
    assert stop.json()["position"] == 1

    emergency = api.post(
        f"/v1/trips/{trip_id}/events",
        json={"kind": "emergency", "command": "SAMU 192"},
    )
    assert emergency.status_code == 201

    finished = api.post(
        f"/v1/trips/{trip_id}/finish",
        json={
            "endReason": "button",
            "distanceMeters": 6_120.5,
            "path": [
                {"latitude": -22.9056, "longitude": -47.0608},
                {"latitude": -22.8616, "longitude": -47.0452},
            ],
        },
    )
    assert finished.status_code == 200

    summary = finished.json()
    assert summary["endReason"] == "button"
    assert summary["distanceMeters"] == 6_120.5
    assert summary["stopCount"] == 1
    assert len(summary["path"]) == 2
    assert summary["longestStretchWithoutStopSeconds"] is not None
    assert [e["kind"] for e in summary["events"]] == [
        "trip_started",
        "stop",
        "emergency",
        "trip_ended",
    ]

    history = api.get("/v1/trips").json()
    assert history["count"] == 1
    assert history["trips"][0]["id"] == trip_id
    assert history["trips"][0]["stopCount"] == 1
    # O card traz o destino: é dele que saem os "Últimos" da tela de destino.
    assert history["trips"][0]["destination"] == {"latitude": -22.8616, "longitude": -47.0452}


def test_viagem_encerrada_nao_aceita_evento_nem_segundo_encerramento(api):
    trip_id = _start(api)["id"]
    body = {"endReason": "arrival", "distanceMeters": 10}

    assert api.post(f"/v1/trips/{trip_id}/finish", json=body).status_code == 200

    again = api.post(f"/v1/trips/{trip_id}/finish", json=body)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "trip_already_finished"

    late = api.post(f"/v1/trips/{trip_id}/events", json={"kind": "command"})
    assert late.status_code == 409


def test_viagem_de_outro_aparelho_e_invisivel(api):
    trip_id = _start(api)["id"]

    response = api.get(f"/v1/trips/{trip_id}", headers={"X-Atlas-Device": OTHER_DEVICE})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "trip_not_found"

    assert api.get("/v1/trips", headers={"X-Atlas-Device": OTHER_DEVICE}).json()["count"] == 0


def test_sem_identificador_do_aparelho_o_pedido_e_invalido(api):
    response = api.get("/v1/trips", headers={"X-Atlas-Device": "nao-e-um-uuid"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_vocabulario_da_ia_e_fechado(api):
    trip_id = _start(api)["id"]

    response = api.post(
        f"/v1/trips/{trip_id}/events",
        json={"kind": "recommendation", "decision": "dormir"},
    )
    assert response.status_code == 422


def test_nao_existe_rota_para_apagar_viagem(api):
    trip_id = _start(api)["id"]

    assert api.delete(f"/v1/trips/{trip_id}").status_code == 405


# --- Regras do resumo ------------------------------------------------------


def test_emocao_predominante_e_a_mais_frequente():
    assert predominant_emotion(["cansado", None, "tenso", "cansado"]).value == "cansado"


def test_emocao_predominante_sem_leitura_e_nula():
    assert predominant_emotion([None, None, "desconhecida"]) is None


def test_maior_trecho_sem_parada_e_a_viagem_inteira_sem_paradas():
    start = datetime(2026, 9, 18, 8, 0, tzinfo=UTC)
    end = start + timedelta(hours=2)

    assert longest_stretch_seconds(start, end, []) == 7_200


def test_maior_trecho_sem_parada_entre_paradas():
    start = datetime(2026, 9, 18, 8, 0, tzinfo=UTC)
    stops = [start + timedelta(minutes=30), start + timedelta(minutes=140)]
    end = start + timedelta(minutes=160)

    # 0→30, 30→140, 140→160: o maior é o do meio, 110 min.
    assert longest_stretch_seconds(start, end, stops) == 110 * 60


def test_parada_fora_do_intervalo_nao_gera_trecho_negativo():
    start = datetime(2026, 9, 18, 8, 0, tzinfo=UTC)
    end = start + timedelta(minutes=60)

    assert longest_stretch_seconds(start, end, [start - timedelta(minutes=5)]) == 3_600
