"""
Ambiente dos testes.

Nada aqui toca a rede: o provider externo é interceptado por `respx` e o
Supabase é substituído por um dublê em memória. Os testes rodam sem projeto
Supabase, sem OSRM e sem simulador — a mesma disciplina que o README do
aplicativo pede para os utilitários puros.
"""

import os
from typing import Any

import pytest

os.environ.setdefault("ATLAS_SUPABASE_URL", "https://projeto-de-teste.supabase.co")
os.environ.setdefault("ATLAS_SUPABASE_SERVICE_KEY", "chave-de-teste-suficientemente-longa")
os.environ.setdefault("ATLAS_OSRM_BASE_URL", "https://osrm.test")


class FakeDatabase:
    """
    Dublê do `SupabaseRest`.

    Guarda o que foi escrito e devolve o que foi programado. Registra as
    chamadas para que um teste possa afirmar que o cache **não** foi consultado.
    """

    def __init__(self) -> None:
        self.rows: dict[str, list[dict[str, Any]]] = {}
        self.rpc_rows: list[dict[str, Any]] = []
        self.upserts: list[tuple[str, dict[str, Any]]] = []
        self.selects: list[tuple[str, dict[str, Any] | None]] = []
        self.ping_fails = False
        self.raises: Exception | None = None

    async def select(self, table: str, *, params: dict[str, Any] | None = None):
        self.selects.append((table, params))
        if self.raises:
            raise self.raises
        return self.rows.get(table, [])

    async def rpc(self, function: str, arguments: dict[str, Any]):
        if self.raises:
            raise self.raises
        return self.rpc_rows

    async def upsert(self, table: str, row: dict[str, Any], *, on_conflict: str) -> None:
        if self.raises:
            raise self.raises
        self.upserts.append((table, row))

    async def ping(self) -> None:
        if self.ping_fails:
            from app.core.errors import DatabaseUnavailable

            raise DatabaseUnavailable("banco fora, no teste")

    async def aclose(self) -> None:
        return None


@pytest.fixture
def database() -> FakeDatabase:
    return FakeDatabase()


@pytest.fixture
def client(database: FakeDatabase):
    """
    Cliente HTTP contra a aplicação real, com o banco trocado pelo dublê.

    O `lifespan` roda de verdade — é ele que cria o cliente `httpx` de saída
    que o `respx` vai interceptar — e só o `state.database` é substituído.
    """
    from fastapi.testclient import TestClient

    from app.main import create_app

    app = create_app()

    with TestClient(app) as test_client:
        app.state.database = database
        yield test_client
