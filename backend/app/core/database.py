"""
Acesso ao Postgres do Supabase pela API REST (PostgREST).

Por que não o SDK: o Atlas usa duas tabelas e três operações — selecionar
lugares, ler o cache de rotas, gravar no cache de rotas. O PostgREST responde a
isso com HTTP puro, e a API já mantém um cliente `httpx` para falar com o
provider de rotas. Um cliente só, uma forma só de tratar timeout e erro —
a mesma escolha que o aplicativo fez em `utils/http.ts` ao dispensar o Axios.

Autenticação usa a **chave de serviço**, que ignora RLS. É deliberado: o
`route_cache` não tem policy alguma justamente para que só este processo o
alcance.
"""

from typing import Any

import httpx

from app.core.config import Settings
from app.core.errors import DatabaseUnavailable


class SupabaseRest:
    """Cliente fino do PostgREST, com o tempo limite e os erros já resolvidos."""

    def __init__(self, settings: Settings) -> None:
        self._client = httpx.AsyncClient(
            base_url=f"{str(settings.supabase_url).rstrip('/')}/rest/v1",
            headers={
                "apikey": settings.supabase_service_key,
                "authorization": f"Bearer {settings.supabase_service_key}",
                "accept": "application/json",
                "content-type": "application/json",
            },
            timeout=settings.outbound_timeout_seconds,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def select(
        self,
        table: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Executa um GET e devolve as linhas já desserializadas."""
        response = await self._request("GET", f"/{table}", params=params)
        payload = self._json(response)

        if not isinstance(payload, list):
            raise DatabaseUnavailable("O banco devolveu um corpo inesperado em uma consulta.")

        return payload

    async def rpc(self, function: str, arguments: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Chama uma função do Postgres.

        Os argumentos vão no corpo, como JSON — é o que mantém o termo de busca
        do usuário do lado dos dados, e nunca do lado da sintaxe da consulta.
        """
        response = await self._request("POST", f"/rpc/{function}", json=arguments)
        payload = self._json(response)

        if not isinstance(payload, list):
            raise DatabaseUnavailable(f"A função {function} devolveu um corpo inesperado.")

        return payload

    async def upsert(self, table: str, row: dict[str, Any], *, on_conflict: str) -> None:
        """Insere ou sobrescreve uma linha. Não devolve corpo — ninguém precisa dele."""
        await self._request(
            "POST",
            f"/{table}",
            params={"on_conflict": on_conflict},
            json=[row],
            headers={"prefer": "resolution=merge-duplicates,return=minimal"},
        )

    async def ping(self) -> None:
        """Confirma que o banco responde. Usado pelo /health."""
        await self._request("GET", "/places", params={"select": "id", "limit": 1})

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        try:
            response = await self._client.request(
                method, path, params=params, json=json, headers=headers
            )
        except httpx.TimeoutException as error:
            raise DatabaseUnavailable(
                "O banco de dados demorou demais para responder.", error
            ) from error
        except httpx.HTTPError as error:
            raise DatabaseUnavailable(
                "Não foi possível conectar ao banco de dados.", error
            ) from error

        if response.is_error:
            # O corpo do PostgREST traz `message` e `hint`; ele vai para o log
            # pela exceção, nunca para o cliente.
            raise DatabaseUnavailable(
                f"O banco de dados respondeu com erro ({response.status_code}): "
                f"{response.text[:200]}"
            )

        return response

    @staticmethod
    def _json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except ValueError as error:
            raise DatabaseUnavailable(
                "O banco devolveu um corpo que não é JSON válido.", error
            ) from error
