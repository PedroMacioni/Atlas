"""
Lugares próximos: quais são, a que distância de carro, em quanto tempo e
com que nota (RF-08).

Passos:
1. tenta as fontes principais em ordem: Google Places (com nota) e depois
   TomTom (sem nota), cada uma só se tiver chave e limite no dia;
2. se nenhuma responder, usa o OpenStreetMap (grátis, sem chave);
3. calcula distância e tempo de carro de todos numa chamada ao OSRM;
4. devolve os `limit` mais rápidos de alcançar.

As fontes ordenam por linha reta, o que engana na cidade (o posto do outro
lado da rodovia parece perto). Por isso pedimos alguns a mais e ordenamos
pelo tempo de carro.
"""

import logging
from dataclasses import dataclass

from app.core.errors import NearbyUnavailableError
from app.providers.nearby import Candidate, NearbyProvider, NearbyUnavailable
from app.providers.osrm import OsrmRouteProvider
from app.schemas.coordinate import Coordinate
from app.schemas.nearby import NearbyCategory, NearbyPlace, NearbyResponse
from app.services.daily_budget import DailyBudget
from app.utils.geo import distance_meters

logger = logging.getLogger("atlas.api")

# Nomes que às vezes aparecem como "hospital" em catálogos abertos, mas não
# atendem emergência (vigilância, farmácia, consultório...).
_NOT_EMERGENCY_MEDICAL_TERMS = (
    "vigilância",
    "vigilancia",
    "vigilance",
    "secretaria",
    "prefeitura",
    "farmácia",
    "farmacia",
    "laboratório",
    "laboratorio",
    "consultório",
    "consultorio",
    "odont",
    "veterin",
)

# 3 é o que o escopo pede (RF-08) e o que a voz lê; a tela de destino pede até 10.
DEFAULT_RESULTS = 3
MAX_RESULTS = 10
# Quantos candidatos pedir antes de ordenar pelo tempo de carro (o dobro, no mínimo 6).
MIN_CANDIDATES = 6

RADIUS_METERS: dict[NearbyCategory, float] = {
    NearbyCategory.POSTO: 10_000,
    NearbyCategory.RESTAURANTE: 10_000,
    NearbyCategory.HOTEL: 20_000,
    NearbyCategory.PONTO_TURISTICO: 30_000,
    # Hospital pode estar longe na estrada; é melhor achar a 40 km do que nenhum.
    NearbyCategory.HOSPITAL: 40_000,
    NearbyCategory.DESCANSO: 20_000,
    NearbyCategory.PARADA: 15_000,
}


@dataclass(frozen=True)
class NearbySource:
    """Uma fonte principal, com o seu limite diário."""

    provider: NearbyProvider
    # Nome que aparece no `fallback_reason`: "Google Places", "TomTom".
    label: str
    budget: DailyBudget


class NearbyService:
    def __init__(
        self,
        *,
        sources: list[NearbySource],
        fallback: NearbyProvider,
        router: OsrmRouteProvider,
    ) -> None:
        self._sources = sources
        self._fallback = fallback
        self._router = router

    async def search(
        self, category: NearbyCategory, origin: Coordinate, limit: int = DEFAULT_RESULTS
    ) -> NearbyResponse:
        limit = min(limit, MAX_RESULTS)
        wanted = max(limit * 2, MIN_CANDIDATES)
        radius = RADIUS_METERS[category]
        candidates, source, reason = await self._candidates(category, origin, radius, wanted)

        # Primeiro os mais perto em linha reta, para calcular o tempo só dos que têm chance.
        candidates.sort(key=lambda c: distance_meters(origin, c.location))
        candidates = candidates[:wanted]

        matrix = await self._router.get_matrix(origin, [c.location for c in candidates])
        places = [_to_place(c, origin, road) for c, road in zip(candidates, matrix, strict=True)]

        # Quem tem tempo de carro vem antes, pelo tempo; os outros, pela linha reta.
        places.sort(
            key=lambda p: (p.duration_seconds is None, p.duration_seconds or p.distance_meters)
        )

        return NearbyResponse(
            category=category, source=source, fallback_reason=reason, places=places[:limit]
        )

    async def _candidates(
        self, category: NearbyCategory, origin: Coordinate, radius: float, wanted: int
    ) -> tuple[list[Candidate], str, str | None]:
        # Motivo de a fonte preferida não ter sido usada (guardamos só o primeiro).
        reason = None if self._sources else "nenhuma fonte com chave configurada"

        for source in self._sources:
            if not source.budget.try_spend():
                reason = reason or f"limite diário do {source.label} atingido"
                continue
            try:
                found = await source.provider.search(category, origin, radius, wanted)
            except NearbyUnavailable as error:
                logger.warning("%s falhou: %s", source.label, error)
                reason = reason or f"{source.label} indisponível"
                continue

            found = _appropriate_candidates(category, found)
            if found:
                return found, source.provider.id, reason

            reason = reason or (
                f"{source.label} sem hospitais adequados"
                if category is NearbyCategory.HOSPITAL
                else f"{source.label} sem resultados"
            )

        try:
            found = await self._fallback.search(category, origin, radius, wanted)
        except NearbyUnavailable as error:
            logger.warning("OpenStreetMap também falhou: %s", error)
            raise NearbyUnavailableError(
                "Não foi possível buscar lugares próximos agora."
            ) from error

        return _appropriate_candidates(category, found), self._fallback.id, reason


def _appropriate_candidates(
    category: NearbyCategory, candidates: list[Candidate]
) -> list[Candidate]:
    """Na busca de hospital, tira da lista o que não atende emergência."""
    if category is not NearbyCategory.HOSPITAL:
        return candidates

    return [
        candidate
        for candidate in candidates
        if not any(term in candidate.name.casefold() for term in _NOT_EMERGENCY_MEDICAL_TERMS)
    ]


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
