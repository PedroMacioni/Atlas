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
from app.schemas.route import ManeuverModifier, ManeuverType, RouteStep

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

    async def get_route(
        self,
        origin: Coordinate,
        destination: Coordinate,
        waypoints: list[Coordinate] | None = None,
    ) -> ProviderRoute:
        payload = await self._fetch([origin, *(waypoints or []), destination])
        return self._parse(payload)

    async def get_matrix(
        self, origin: Coordinate, destinations: list[Coordinate]
    ) -> list[tuple[float, float] | None]:
        """
        Distância e tempo de carro da origem até cada destino, numa chamada só.

        É o serviço `table` do OSRM. Devolve `(metros, segundos)` por destino,
        na mesma ordem, ou `None` para um destino sem trajeto. Uma falha do
        serviço devolve tudo `None` em vez de levantar: quem chama cai na
        distância em linha reta, e a lista de opções continua de pé.
        """
        if not destinations:
            return []

        points = ";".join(f"{p.longitude},{p.latitude}" for p in [origin, *destinations])
        url = f"{self._base_url}/table/v1/{OSRM_PROFILE}/{points}"

        try:
            response = await self._client.get(
                url, params={"sources": "0", "annotations": "duration,distance"}
            )
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            return [None] * len(destinations)

        if not isinstance(payload, dict) or payload.get("code") != "Ok":
            return [None] * len(destinations)

        durations = (payload.get("durations") or [[]])[0]
        distances = (payload.get("distances") or [[]])[0]
        result: list[tuple[float, float] | None] = []

        # O índice 0 é a própria origem; os destinos começam em 1.
        for index in range(1, len(destinations) + 1):
            try:
                distance, duration = distances[index], durations[index]
            except (IndexError, TypeError):
                result.append(None)
                continue
            valid = isinstance(distance, int | float) and isinstance(duration, int | float)
            result.append((float(distance), float(duration)) if valid else None)

        return result

    async def _fetch(self, points: list[Coordinate]) -> dict[str, Any]:
        # A URL do OSRM leva os pontos no path, na ordem longitude,latitude:
        # origem, paradas intermediárias e destino.
        path = ";".join(f"{p.longitude},{p.latitude}" for p in points)
        url = f"{self._base_url}/route/v1/{OSRM_PROFILE}/{path}"

        try:
            response = await self._client.get(
                url,
                params={
                    # GeoJSON dispensa decodificar polyline codificada.
                    "overview": "full",
                    "geometries": "geojson",
                    "alternatives": "false",
                    # As manobras são o que permite a faixa de instrução na
                    # tela de viagem. Custam bytes na resposta, não uma
                    # chamada a mais.
                    "steps": "true",
                    # Um raio por ponto, na ordem em que eles aparecem na URL.
                    "radiuses": ";".join([str(SNAP_RADIUS_METERS)] * len(points)),
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

        return ProviderRoute(coordinates, distance, duration, _parse_steps(route))


# Vocabulário do OSRM traduzido para o do Atlas. O que não estiver aqui vira
# `CONTINUE`: seguir em frente é a instrução que nunca manda o motorista para o
# lugar errado.
_MANEUVER_TYPES: dict[str, ManeuverType] = {
    "depart": ManeuverType.DEPART,
    "arrive": ManeuverType.ARRIVE,
    "turn": ManeuverType.TURN,
    "continue": ManeuverType.CONTINUE,
    "merge": ManeuverType.MERGE,
    "on ramp": ManeuverType.ON_RAMP,
    "off ramp": ManeuverType.OFF_RAMP,
    "fork": ManeuverType.FORK,
    "end of road": ManeuverType.END_OF_ROAD,
    "roundabout": ManeuverType.ROUNDABOUT,
    "rotary": ManeuverType.ROTARY,
    "roundabout turn": ManeuverType.ROUNDABOUT,
    "new name": ManeuverType.NEW_NAME,
    "notification": ManeuverType.CONTINUE,
    "exit roundabout": ManeuverType.ROUNDABOUT,
    "exit rotary": ManeuverType.ROTARY,
}

_MANEUVER_MODIFIERS: dict[str, ManeuverModifier] = {
    "left": ManeuverModifier.LEFT,
    "right": ManeuverModifier.RIGHT,
    "sharp left": ManeuverModifier.SHARP_LEFT,
    "sharp right": ManeuverModifier.SHARP_RIGHT,
    "slight left": ManeuverModifier.SLIGHT_LEFT,
    "slight right": ManeuverModifier.SLIGHT_RIGHT,
    "straight": ManeuverModifier.STRAIGHT,
    "uturn": ManeuverModifier.UTURN,
}


def _parse_steps(route: dict[str, Any]) -> list[RouteStep]:
    """
    Converte os passos do OSRM em manobras posicionadas sobre a rota.

    O OSRM descreve cada passo com a manobra no **início** dele e a distância
    que ele cobre até a próxima. A API converte isso para distância acumulada
    desde a partida: assim o aplicativo sabe quanto falta para a próxima
    manobra subtraindo o que já percorreu, sem refazer geometria.

    Manobras nunca derrubam uma rota. Se o provider não as mandou, ou mandou em
    formato inesperado, a lista volta vazia e a tela mostra o trajeto sem a
    faixa de instrução — que é exatamente o comportamento anterior a elas.
    """
    steps: list[RouteStep] = []
    traveled = 0.0

    for leg in route.get("legs") or []:
        if not isinstance(leg, dict):
            continue

        for raw in leg.get("steps") or []:
            if not isinstance(raw, dict):
                continue

            maneuver = raw.get("maneuver")

            if not isinstance(maneuver, dict):
                continue

            location = _parse_location(maneuver.get("location"))

            if location is None:
                continue

            steps.append(
                RouteStep(
                    type=_MANEUVER_TYPES.get(
                        str(maneuver.get("type")), ManeuverType.CONTINUE
                    ),
                    modifier=_MANEUVER_MODIFIERS.get(str(maneuver.get("modifier"))),
                    road_name=str(raw.get("name") or ""),
                    distance_along_route_meters=traveled,
                    location=location,
                )
            )

            step_distance = raw.get("distance")

            if isinstance(step_distance, int | float) and step_distance > 0:
                traveled += float(step_distance)

    return steps


def _parse_location(raw: Any) -> Coordinate | None:
    """Ponto da manobra, em [longitude, latitude] como todo GeoJSON."""
    if not isinstance(raw, list | tuple) or len(raw) < 2:
        return None

    if not _is_finite_pair(raw[0], raw[1]):
        return None

    return Coordinate(latitude=raw[1], longitude=raw[0])


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
