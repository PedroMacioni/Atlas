"""
Erros de domínio da API e a forma única de reportá-los.

Toda falha sai como o mesmo envelope JSON:

    {"error": {"code": "route_provider_timeout", "message": "..."}}

O `code` é estável e legível por máquina; o aplicativo escolhe a mensagem de
interface a partir dele, do mesmo jeito que hoje decide a partir de
`HttpError.kind` em `utils/http.ts`. A `message` é auxiliar — humana, em
português, útil em log e em tela de diagnóstico.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("atlas.api")


class AtlasError(Exception):
    """Base de toda falha esperada da API."""

    code: str = "internal_error"
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, message: str, cause: Exception | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.cause = cause


class RouteProviderTimeout(AtlasError):
    """O serviço de rotas não respondeu dentro do tempo limite."""

    code = "route_provider_timeout"
    status_code = status.HTTP_504_GATEWAY_TIMEOUT


class RouteProviderUnavailable(AtlasError):
    """O serviço de rotas está fora do ar, recusou a chamada ou respondeu mal."""

    code = "route_provider_unavailable"
    status_code = status.HTTP_502_BAD_GATEWAY


class RouteNotFound(AtlasError):
    """Não existe trajeto entre os pontos pedidos."""

    code = "route_not_found"
    status_code = status.HTTP_404_NOT_FOUND


class PlaceNotFound(AtlasError):
    """O identificador de lugar não existe no catálogo."""

    code = "place_not_found"
    status_code = status.HTTP_404_NOT_FOUND


class DatabaseUnavailable(AtlasError):
    """O Supabase não respondeu ou respondeu com erro."""

    code = "database_unavailable"
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE


def _envelope(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, content={"error": {"code": code, "message": message}}
    )


def register_error_handlers(app: FastAPI) -> None:
    """Liga os handlers que garantem o envelope único em qualquer resposta de erro."""

    @app.exception_handler(AtlasError)
    async def _handle_atlas_error(_: Request, error: AtlasError) -> JSONResponse:
        return _envelope(error.code, error.message, error.status_code)

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        # O detalhe do Pydantic é preciso, mas verboso e em inglês. O app só
        # precisa saber que o pedido estava malformado; o detalhe vai junto
        # para quem está depurando.
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "error": {
                    "code": "invalid_request",
                    "message": "O corpo ou os parâmetros da requisição são inválidos.",
                    "details": error.errors(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, error: Exception) -> JSONResponse:
        # Nada de stack trace no corpo: o log fica com o detalhe, o cliente
        # recebe só o código.
        logger.exception("Falha não tratada na API", exc_info=error)
        return _envelope(
            "internal_error",
            "Falha inesperada na API do Atlas.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
