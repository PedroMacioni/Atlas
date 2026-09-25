"""
Acesso ao banco Supabase pela API REST (PostgREST), usando httpx.

Não usamos o SDK do Supabase: as operações são poucas e simples, e assim
temos uma única forma de tratar tempo limite e erros.

A autenticação usa a chave de serviço, que ignora as regras de RLS. É de
propósito: tabelas como `route_cache` não têm regra nenhuma, então só este
servidor consegue acessá-las.
"""

from typing import Any

import httpx

from app.core.config import Settings
from app.core.errors import DatabaseUnavailable


class SupabaseRest:
    """Cliente simples do PostgREST e do Storage do Supabase."""

    def __init__(self, settings: Settings) -> None:
        base = str(settings.supabase_url).rstrip("/")
        credentials = {
            "apikey": settings.supabase_service_key,
            "authorization": f"Bearer {settings.supabase_service_key}",
        }
        # Storage (arquivos): as fotos do diário ficam num bucket privado.
        self._storage = httpx.AsyncClient(
            base_url=f"{base}/storage/v1",
            headers=credentials,
            timeout=settings.outbound_timeout_seconds,
        )
        self._client = httpx.AsyncClient(
            base_url=f"{base}/rest/v1",
            headers={
                **credentials,
                "accept": "application/json",
                "content-type": "application/json",
            },
            timeout=settings.outbound_timeout_seconds,
        )

    async def aclose(self) -> None:
        await self._client.aclose()
        await self._storage.aclose()

    async def upload(self, bucket: str, path: str, content: bytes, *, content_type: str) -> str:
        """Salva um arquivo no bucket e devolve o caminho dele."""
        try:
            response = await self._storage.post(
                f"/object/{bucket}/{path}",
                content=content,
                headers={"content-type": content_type},
            )
        except httpx.HTTPError as error:
            raise DatabaseUnavailable("Não foi possível guardar o arquivo.", error) from error

        if response.is_error:
            raise DatabaseUnavailable(
                f"O armazenamento respondeu com erro ({response.status_code}): "
                f"{response.text[:200]}"
            )

        return path

    async def sign(self, bucket: str, paths: list[str], *, expires_in: int) -> dict[str, str]:
        """
        Gera links temporários para arquivos de um bucket privado.

        Uma chamada só para a lista toda. Se um arquivo falhar, ele só fica de
        fora do resultado, sem derrubar o resumo da viagem.
        """
        if not paths:
            return {}

        try:
            response = await self._storage.post(
                f"/object/sign/{bucket}",
                json={"paths": paths, "expiresIn": expires_in},
            )
        except httpx.HTTPError as error:
            raise DatabaseUnavailable("Não foi possível assinar as fotos.", error) from error

        if response.is_error:
            raise DatabaseUnavailable(
                f"O armazenamento respondeu com erro ({response.status_code}): "
                f"{response.text[:200]}"
            )

        signed = {}
        for item in self._json(response) or []:
            url, path = item.get("signedURL"), item.get("path")
            if url and path and not item.get("error"):
                # O `signedURL` vem relativo a `/storage/v1`.
                signed[path] = f"{str(self._storage.base_url).rstrip('/')}{url}"

        return signed

    async def select(
        self,
        table: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Faz um GET na tabela e devolve as linhas."""
        response = await self._request("GET", f"/{table}", params=params)
        payload = self._json(response)

        if not isinstance(payload, list):
            raise DatabaseUnavailable("O banco devolveu um corpo inesperado em uma consulta.")

        return payload

    async def rpc(self, function: str, arguments: dict[str, Any]) -> list[dict[str, Any]]:
        """
        Chama uma função SQL do banco.

        Os argumentos vão como JSON no corpo, então o texto digitado pelo usuário
        nunca vira parte da consulta (evita SQL injection).
        """
        response = await self._request("POST", f"/rpc/{function}", json=arguments)
        payload = self._json(response)

        if not isinstance(payload, list):
            raise DatabaseUnavailable(f"A função {function} devolveu um corpo inesperado.")

        return payload

    async def upsert(self, table: str, row: dict[str, Any], *, on_conflict: str) -> None:
        """Insere ou atualiza uma linha, sem devolver nada."""
        await self._request(
            "POST",
            f"/{table}",
            params={"on_conflict": on_conflict},
            json=[row],
            headers={"prefer": "resolution=merge-duplicates,return=minimal"},
        )

    async def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        """Insere uma linha e devolve como ela ficou no banco (com id e padrões)."""
        response = await self._request(
            "POST",
            f"/{table}",
            json=[row],
            headers={"prefer": "return=representation"},
        )
        return self._single_row(response, table)

    async def upsert_returning(
        self, table: str, row: dict[str, Any], *, on_conflict: str
    ) -> dict[str, Any]:
        """Igual ao `upsert`, mas devolve a linha gravada."""
        response = await self._request(
            "POST",
            f"/{table}",
            params={"on_conflict": on_conflict},
            json=[row],
            headers={"prefer": "resolution=merge-duplicates,return=representation"},
        )
        return self._single_row(response, table)

    async def update(
        self, table: str, values: dict[str, Any], *, filters: dict[str, str]
    ) -> list[dict[str, Any]]:
        """
        Atualiza as linhas que batem com `filters` (sintaxe do PostgREST, ex. `eq.x`).

        Devolve as linhas alteradas. Lista vazia = nenhuma linha bateu com o filtro.
        """
        response = await self._request(
            "PATCH",
            f"/{table}",
            params=filters,
            json=values,
            headers={"prefer": "return=representation"},
        )
        payload = self._json(response)

        if not isinstance(payload, list):
            raise DatabaseUnavailable(f"O banco devolveu um corpo inesperado ao alterar {table}.")

        return payload

    async def ping(self) -> None:
        """Testa se o banco responde. Usado pelo /health."""
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
            # O detalhe do erro vai para o log, nunca para o cliente.
            raise DatabaseUnavailable(
                f"O banco de dados respondeu com erro ({response.status_code}): "
                f"{response.text[:200]}"
            )

        return response

    @classmethod
    def _single_row(cls, response: httpx.Response, table: str) -> dict[str, Any]:
        payload = cls._json(response)

        if not isinstance(payload, list) or len(payload) != 1 or not isinstance(payload[0], dict):
            raise DatabaseUnavailable(f"O banco não devolveu a linha gravada em {table}.")

        return payload[0]

    @staticmethod
    def _json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except ValueError as error:
            raise DatabaseUnavailable(
                "O banco devolveu um corpo que não é JSON válido.", error
            ) from error
