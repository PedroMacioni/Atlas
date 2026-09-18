"""
Persistência de viagens, diário de bordo e paradas.

Toda consulta de viagem filtra pelo aparelho dono dela. Não existe leitura
"por id" solta: uma viagem de outro aparelho é, para quem pergunta, uma viagem
que não existe.

As linhas saem como o banco as tem (snake_case, colunas planas); a montagem
das respostas é do serviço.
"""

from typing import Any
from uuid import UUID

from app.core.database import SupabaseRest

Row = dict[str, Any]

_TRIP_COLUMNS = (
    "id,origin_name,origin_latitude,origin_longitude,"
    "destination_name,destination_latitude,destination_longitude,"
    "started_at,ended_at,end_reason,distance_meters,duration_seconds,predominant_emotion"
)


class TripRepository:
    def __init__(self, database: SupabaseRest) -> None:
        self._database = database

    async def ensure_device(self, anonymous_uuid: UUID) -> UUID:
        """Devolve o id interno do aparelho, registrando-o na primeira vez."""
        row = await self._database.upsert_returning(
            "devices", {"anonymous_uuid": str(anonymous_uuid)}, on_conflict="anonymous_uuid"
        )
        return UUID(str(row["id"]))

    async def create_trip(self, row: Row) -> Row:
        return await self._database.insert("trips", row)

    async def get_trip(
        self, device_id: UUID, trip_id: UUID, *, with_path: bool = False
    ) -> Row | None:
        columns = f"{_TRIP_COLUMNS},path" if with_path else _TRIP_COLUMNS
        rows = await self._database.select(
            "trips",
            params={
                "select": columns,
                "id": f"eq.{trip_id}",
                "device_id": f"eq.{device_id}",
                "limit": 1,
            },
        )
        return rows[0] if rows else None

    async def list_trips(self, device_id: UUID, *, limit: int) -> list[Row]:
        # `stops(count)` é a contagem embutida do PostgREST, pela chave
        # estrangeira: uma consulta só, em vez de uma por card.
        return await self._database.select(
            "trips",
            params={
                "select": f"{_TRIP_COLUMNS},stops(count)",
                "device_id": f"eq.{device_id}",
                "order": "started_at.desc",
                "limit": limit,
            },
        )

    async def finish_trip(self, device_id: UUID, trip_id: UUID, values: Row) -> Row | None:
        # `ended_at=is.null` no filtro faz o encerramento ser atômico: duas
        # chamadas simultâneas não encerram a mesma viagem duas vezes.
        rows = await self._database.update(
            "trips",
            values,
            filters={
                "id": f"eq.{trip_id}",
                "device_id": f"eq.{device_id}",
                "ended_at": "is.null",
            },
        )
        return rows[0] if rows else None

    async def add_event(self, row: Row) -> Row:
        return await self._database.insert("trip_events", row)

    async def list_events(self, trip_id: UUID) -> list[Row]:
        return await self._database.select(
            "trip_events",
            params={
                "select": (
                    "id,kind,occurred_at,latitude,longitude,command,emotion,"
                    "emotion_confidence,image_class,decision,justification"
                ),
                "trip_id": f"eq.{trip_id}",
                "order": "occurred_at.asc",
            },
        )

    async def add_recommendation(self, row: Row) -> Row:
        return await self._database.insert("recommendations", row)

    async def list_recommendations(self, trip_id: UUID) -> list[Row]:
        """As recomendações da viagem, pelo evento do diário a que pertencem."""
        return await self._database.select(
            "recommendations",
            params={
                # `!inner` transforma o embed num JOIN: só vêm as recomendações
                # cujo evento pertence a esta viagem.
                "select": (
                    "id,decision,confidence,accepted,simulated,created_at,"
                    "trip_events!inner(trip_id)"
                ),
                "trip_events.trip_id": f"eq.{trip_id}",
                "order": "created_at.asc",
            },
        )

    async def respond_recommendation(
        self, trip_id: UUID, recommendation_id: UUID, values: Row
    ) -> Row | None:
        """Grava a resposta do usuário, uma vez só — `accepted=is.null`."""
        known = [
            r for r in await self.list_recommendations(trip_id) if r["id"] == str(recommendation_id)
        ]
        if not known:
            return None

        rows = await self._database.update(
            "recommendations",
            values,
            filters={"id": f"eq.{recommendation_id}", "accepted": "is.null"},
        )
        return rows[0] if rows else known[0]

    async def add_stop(self, row: Row) -> Row:
        return await self._database.insert("stops", row)

    async def list_stops(self, trip_id: UUID) -> list[Row]:
        return await self._database.select(
            "stops",
            params={
                "select": "id,position,name,category,reason,latitude,longitude,created_at",
                "trip_id": f"eq.{trip_id}",
                "order": "position.asc",
            },
        )
