"""
Contrato do provider de rotas — a tradução do `RouteProvider` do aplicativo.

A API conhece só este protocolo. Trocar OSRM por Google Routes ou Mapbox é
escrever outra implementação e registrá-la em `services/route_service.py`;
nenhum router muda. É a mesma inversão que o app já faz em
`features/routing/services/route-service.ts`, agora do lado do servidor — onde a
chave de API pode finalmente existir sem ser embarcada no binário.
"""

from typing import Protocol, runtime_checkable

from app.schemas.coordinate import Coordinate


class ProviderRoute:
    """Resultado cru de um provider, antes de virar resposta HTTP."""

    __slots__ = ("coordinates", "distance_meters", "duration_seconds")

    def __init__(
        self,
        coordinates: list[Coordinate],
        distance_meters: float,
        duration_seconds: float,
    ) -> None:
        self.coordinates = coordinates
        self.distance_meters = distance_meters
        self.duration_seconds = duration_seconds


@runtime_checkable
class RouteProvider(Protocol):
    """Identificador legível, usado em log, no cache e no /health."""

    id: str

    async def get_route(self, origin: Coordinate, destination: Coordinate) -> ProviderRoute:
        """Calcula o trajeto ou levanta um erro de `core.errors`."""
        ...
