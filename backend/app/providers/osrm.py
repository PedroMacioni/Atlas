"""
Provider de rotas do OSRM.

┌──────────────────────────────────────────────────────────────────────────┐
│ ATENÇÃO — SOLUÇÃO TEMPORÁRIA DE DESENVOLVIMENTO                          │
│                                                                          │
│ `router.project-osrm.org` é mantido pelo projeto OSRM apenas como        │
│ demonstração: sem SLA, sem uso comercial, com limites de requisição não  │
│ documentados e sujeito a sair do ar sem aviso.                           │
│                                                                          │
│ O cache desta API reduz bastante a pressão sobre ele, mas não legitima o │
│ uso em produção. Antes de distribuir, aponte `ATLAS_OSRM_BASE_URL` para  │
│ uma instância própria ou escreva outro provider.                         │
└──────────────────────────────────────────────────────────────────────────┘

O mesmo aviso está em `src/features/routing/providers/osrm-route-provider.ts`.

@see https://project-osrm.org/docs/v5.24.0/api/
"""

from typing import Any

import httpx

from app.core.errors import RouteNotFound, RouteProviderTimeout, RouteProviderUnavailable
from app.providers.base import ProviderRoute
from app.schemas.coordinate import Coordinate

# O servidor público expõe apenas o perfil de carro.
OSRM_PROFILE = "driving"

# Distância máxima entre o ponto pedido e a via onde o OSRM vai encaixá-lo.
#
# Sem esse limite o encaixe é ilimitado: um ponto no mar aberto recebe a
# estrada mais próxima do continente, e a API devolve — com `code: Ok` — uma
# rota que começa a mais de mil quilômetros de onde o usuário apontou. Com o
# limite, o OSRM responde `NoSegment`, que esta API traduz para 404.
#
# 10 km é tolerante com zona rural e com imprecisão de GPS, e ainda rejeita
# o que claramente não tem estrada por perto.
SNAP_RADIUS_METERS = 10_000


class OsrmRouteProvider:
    id = "osrm-public-demo"

    def __init__(self, client: httpx.AsyncClient, base_url: str) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")

    async def get_route(self, origin: Coordinate, destination: Coordinate) -> ProviderRoute:
        payload = await self._fetch(origin, destination)
        return self._parse(payload)

    async def _fetch(self, origin: Coordinate, destination: Coordinate) -> dict[str, Any]:
        # A URL do OSRM leva os pontos no path, na ordem longitude,latitude.
        pair = (
            f"{origin.longitude},{origin.latitude};{destination.longitude},{destination.latitude}"
        )
        url = f"{self._base_url}/route/v1/{OSRM_PROFILE}/{pair}"

        try:
            response = await self._client.get(
                url,
                params={
                    # GeoJSON dispensa decodificar polyline codificada.
                    "overview": "full",
                    "geometries": "geojson",
                    "alternatives": "false",
                    "steps": "false",
                    # Um raio por ponto, na ordem em que eles aparecem na URL.
                    "radiuses": f"{SNAP_RADIUS_METERS};{SNAP_RADIUS_METERS}",
                },
            )
        except httpx.TimeoutException as error:
            raise RouteProviderTimeout(
                "O serviço de rotas demorou demais para responder.", error
            ) from error
        except httpx.HTTPError as error:
            raise RouteProviderUnavailable("Sem conexão com o serviço de rotas.", error) from error

        try:
            payload = response.json()
        except ValueError:
            payload = None

        # O OSRM responde 400 com um corpo explicativo quando a recusa é de
        # domínio — `NoSegment` para um ponto sem via dentro do raio de
        # encaixe, por exemplo. Isso não é uma falha do serviço, e o `code` do
        # corpo vale mais que o status: deixar o parsing decidir dá 404 em vez
        # de 502. Só quando não há corpo utilizável é que o status responde.
        if isinstance(payload, dict) and payload.get("code"):
            return payload

        if response.is_error:
            raise RouteProviderUnavailable(
                f"O serviço de rotas respondeu com erro ({response.status_code})."
            )

        raise RouteProviderUnavailable("O serviço de rotas devolveu uma resposta inválida.")

    @staticmethod
    def _parse(payload: dict[str, Any]) -> ProviderRoute:
        """Valida o corpo antes de confiar nele — a mesma checagem do provider do app."""
        code = payload.get("code")

        if code != "Ok":
            # `NoRoute` é resposta legítima do serviço, não falha dele.
            if code in {"NoRoute", "NoSegment"}:
                raise RouteNotFound("Nenhuma rota foi encontrada entre os pontos informados.")
            message = payload.get("message") or f"O serviço de rotas recusou a consulta ({code})."
            raise RouteProviderUnavailable(str(message))

        routes = payload.get("routes")

        if not isinstance(routes, list) or not routes:
            raise RouteNotFound("Nenhuma rota foi encontrada entre os pontos informados.")

        route = routes[0]
        geometry = route.get("geometry") if isinstance(route, dict) else None
        raw_pairs = geometry.get("coordinates") if isinstance(geometry, dict) else None

        if not isinstance(raw_pairs, list):
            raise RouteProviderUnavailable("O serviço de rotas devolveu uma geometria inválida.")

        # GeoJSON usa [longitude, latitude] — a inversão de eixos é
        # responsabilidade do provider, nunca de quem consome.
        coordinates = [
            Coordinate(latitude=pair[1], longitude=pair[0])
            for pair in raw_pairs
            if isinstance(pair, list | tuple)
            and len(pair) >= 2
            and _is_finite_pair(pair[0], pair[1])
        ]

        if len(coordinates) < 2:
            raise RouteProviderUnavailable(
                "A rota recebida não tem pontos suficientes para ser desenhada."
            )

        try:
            distance = float(route["distance"])
            duration = float(route["duration"])
        except (KeyError, TypeError, ValueError) as error:
            raise RouteProviderUnavailable(
                "O serviço de rotas não informou distância e duração.", error
            ) from error

        return ProviderRoute(coordinates, distance, duration)


def _is_finite_pair(longitude: Any, latitude: Any) -> bool:
    """Descarta `null`, string e infinito antes de tentar construir a coordenada."""
    if not isinstance(longitude, int | float) or not isinstance(latitude, int | float):
        return False
    if isinstance(longitude, bool) or isinstance(latitude, bool):
        return False
    return (
        longitude == longitude  # noqa: PLR0124 — descarta NaN
        and latitude == latitude  # noqa: PLR0124
        and abs(longitude) != float("inf")
        and abs(latitude) != float("inf")
        and -180 <= longitude <= 180
        and -90 <= latitude <= 90
    )
