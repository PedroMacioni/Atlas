"""
Cálculo de rotas.

É `POST`, e não `GET`, porque origem e destino são um par de coordenadas que
pertence ao corpo — e porque o resultado não deve ser cacheado por
intermediário nenhum: quem decide a validade de uma rota é esta API, pelo
`route_cache`, com o TTL que ela controla.
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
    Devolve o trajeto entre dois pontos, no formato que a `Polyline` consome.

    `cached` conta a procedência: `true` significa que nenhuma chamada externa
    foi feita para atender este pedido.
    """
    return await service.get_route(payload.origin, payload.destination)
