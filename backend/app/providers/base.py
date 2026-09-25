"""
Contrato (interface) de um serviço de rotas.

A API só conhece este contrato. Para trocar o OSRM por Google Routes ou
Mapbox, basta escrever outra classe com o mesmo formato.
"""

from typing import Protocol, runtime_checkable

from app.schemas.coordinate import Coordinate
from app.schemas.route import RouteStep


class ProviderRoute:
    """Rota como veio do serviço, antes de virar resposta HTTP."""

    __slots__ = ("coordinates", "distance_meters", "duration_seconds", "steps")

    def __init__(
        self,
        coordinates: list[Coordinate],
        distance_meters: float,
        duration_seconds: float,
        steps: list[RouteStep] | None = None,
    ) -> None:
        self.coordinates = coordinates
        self.distance_meters = distance_meters
        self.duration_seconds = duration_seconds
        # Lista vazia (e não `None`) quando o serviço não manda manobras.
        self.steps = steps or []


@runtime_checkable
class RouteProvider(Protocol):
    """Serviço de rotas. `id` aparece no log, no cache e no /health."""

    id: str

    async def get_route(
        self,
        origin: Coordinate,
        destination: Coordinate,
        waypoints: list[Coordinate] | None = None,
    ) -> ProviderRoute:
        """
        Calcula o trajeto ou levanta um erro de `core.errors`.

        `waypoints` são paradas no meio do caminho, em ordem. É assim que um
        desvio aceito pelo usuário (RF-19) entra na rota sem trocar o destino.
        """
        ...
