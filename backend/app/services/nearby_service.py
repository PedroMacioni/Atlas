"""
As 3 opções próximas: quem são, a que distância de carro, em quanto tempo e
com que nota (RF-08).

1. Google Places, se houver chave e ainda houver limite no dia;
2. senão, ou se o Google falhar, OpenStreetMap;
3. distância e tempo **de carro** para os candidatos, numa chamada ao OSRM;
4. as 3 mais rápidas de alcançar.

O Google ordena por distância em linha reta, e em cidade isso engana: o posto
do outro lado da rodovia está "perto" e a 8 minutos de retorno. Por isso o
serviço pede alguns candidatos a mais e decide pelo tempo de carro.
"""

import logging
from collections.abc import Callable
from datetime import date

from app.core.errors import NearbyUnavailableError
from app.providers.nearby import Candidate, NearbyProvider, NearbyUnavailable
from app.providers.osrm import OsrmRouteProvider
from app.schemas.coordinate import Coordinate
from app.schemas.nearby import NearbyCategory, NearbyPlace, NearbyResponse
from app.utils.geo import distance_meters

logger = logging.getLogger("atlas.api")

RESULTS = 3
# Candidatos pedidos à fonte antes de ordenar pelo tempo de carro.
CANDIDATES = 6

RADIUS_METERS: dict[NearbyCategory, float] = {
    NearbyCategory.POSTO: 10_000,
    NearbyCategory.RESTAURANTE: 10_000,
    NearbyCategory.HOTEL: 20_000,
    NearbyCategory.PONTO_TURISTICO: 30_000,
    # Hospital pode estar longe na estrada; melhor achar 3 a 40 km que nenhum.
    NearbyCategory.HOSPITAL: 40_000,
    NearbyCategory.DESCANSO: 20_000,
    NearbyCategory.PARADA: 15_000,
}


class DailyBudget:
    """
    Quantas consultas ao Google ainda cabem hoje.

    A cota gratuita do plano com nota é de 1.000 por mês — cerca de 30 por
    dia. Este contador é a primeira barreira, dentro da API; a segunda, que
    vale mesmo com a API reiniciada, é a cota configurada no console do
    Google (ver README).
    """

    def __init__(self, limit: int, today: Callable[[], date] = date.today) -> None:
        self._limit = limit
        self._today = today
        self._day = today()
        self._used = 0

    def try_spend(self) -> bool:
        if self._today() != self._day:
            self._day, self._used = self._today(), 0

        if self._used >= self._limit:
            return False

        self._used += 1
        return True

    @property
    def remaining(self) -> int:
        return max(0, self._limit - self._used)


class NearbyService:
    def __init__(
        self,
        *,
        google: NearbyProvider | None,
        fallback: NearbyProvider,
        router: OsrmRouteProvider,
        budget: DailyBudget,
    ) -> None:
        self._google = google
        self._fallback = fallback
        self._router = router
        self._budget = budget

    async def search(self, category: NearbyCategory, origin: Coordinate) -> NearbyResponse:
        radius = RADIUS_METERS[category]
        candidates, source, reason = await self._candidates(category, origin, radius)

        # Os mais próximos em linha reta primeiro, para a matriz de tempos
        # olhar só os que têm chance.
        candidates.sort(key=lambda c: distance_meters(origin, c.location))
        candidates = candidates[:CANDIDATES]

        matrix = await self._router.get_matrix(origin, [c.location for c in candidates])
        places = [_to_place(c, origin, road) for c, road in zip(candidates, matrix, strict=True)]

        # Quem tem tempo de carro vem antes, pelo tempo; sem trajeto, pela
        # distância em linha reta.
        places.sort(
            key=lambda p: (p.duration_seconds is None, p.duration_seconds or p.distance_meters)
        )

        return NearbyResponse(
            category=category, source=source, fallback_reason=reason, places=places[:RESULTS]
        )

    async def _candidates(
        self, category: NearbyCategory, origin: Coordinate, radius: float
    ) -> tuple[list[Candidate], str, str | None]:
        reason = None

        if self._google is None:
            reason = "Google Places não configurado"
        elif not self._budget.try_spend():
            reason = "limite diário do Google Places atingido"
        else:
            try:
                return (
                    await self._google.search(category, origin, radius, CANDIDATES),
                    self._google.id,
                    None,
                )
            except NearbyUnavailable as error:
                logger.warning("Google Places falhou, usando OpenStreetMap: %s", error)
                reason = "Google Places indisponível"

        try:
            found = await self._fallback.search(category, origin, radius, CANDIDATES)
        except NearbyUnavailable as error:
            logger.warning("OpenStreetMap também falhou: %s", error)
            raise NearbyUnavailableError(
                "Não foi possível buscar lugares próximos agora."
            ) from error

        return found, self._fallback.id, reason


def _to_place(
    candidate: Candidate, origin: Coordinate, road: tuple[float, float] | None
) -> NearbyPlace:
    return NearbyPlace(
        id=candidate.id,
        name=candidate.name,
        address=candidate.address,
        latitude=candidate.location.latitude,
        longitude=candidate.location.longitude,
        distance_meters=road[0] if road else distance_meters(origin, candidate.location),
        duration_seconds=road[1] if road else None,
        by_road=road is not None,
        rating=candidate.rating,
        rating_count=candidate.rating_count,
    )
