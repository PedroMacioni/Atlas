"""
Cálculo de rotas.

É `POST` porque origem, destino e paradas vão no corpo como JSON. Quem
decide por quanto tempo a rota vale é o cache desta API.
"""

from fastapi import APIRouter, status

from app.core.dependencies import RouteServiceDep
from app.schemas.route import RouteRequest, RouteResponse

router = APIRouter(prefix="/v1/routes", tags=["rotas"])


@router.post(
    "",
    response_model=RouteResponse,
    status_code=status.HTTP_200_OK,
    responses={
        404: {"description": "Nenhum trajeto entre os pontos informados."},
        502: {"description": "O provider de rotas falhou."},
        504: {"description": "O provider de rotas não respondeu no tempo limite."},
    },
)
async def create_route(payload: RouteRequest, service: RouteServiceDep) -> RouteResponse:
    """
    Devolve o trajeto entre dois pontos, pronto para desenhar no mapa.

    `cached: true` indica que a rota veio do cache, sem chamar o serviço externo.
    """
    return await service.get_route(payload.origin, payload.destination, payload.waypoints)
