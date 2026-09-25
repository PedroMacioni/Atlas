"""
TomTom Search: busca de destino por texto e lugares próximos.

É grátis e sem cartão (plano Freemium). Nos nossos testes em Campinas foi a
fonte grátis que achou mais lugares e endereços. Não tem nota.

A chave vai na URL (é o único jeito que a TomTom aceita). Por isso nenhuma
mensagem de erro daqui mostra a URL.

@see https://developer.tomtom.com/search-api/documentation/search-service/fuzzy-search
@see https://developer.tomtom.com/search-api/documentation/search-service/nearby-search
"""

from typing import Any
from urllib.parse import quote

import httpx

from app.providers.nearby import Candidate, NearbyUnavailable
from app.schemas.coordinate import Coordinate
from app.schemas.nearby import NearbyCategory
from app.schemas.place import Place, PlaceCategory

BASE_URL = "https://api.tomtom.com/search/2"

# Resultados em português e só do Brasil.
_LOCALE = {"language": "pt-BR", "countrySet": "BR"}

# Códigos de categoria de POI da TomTom.
NEARBY_CATEGORIES: dict[NearbyCategory, list[int]] = {
    NearbyCategory.POSTO: [7311],
    NearbyCategory.RESTAURANTE: [7315],
    NearbyCategory.HOTEL: [7314],
    # Atração turística, museu, mirante.
    NearbyCategory.PONTO_TURISTICO: [7376, 7317, 7337],
    # Hospital e pronto-socorro. A categoria geral de saúde fica de fora porque
    # inclui consultórios e outros lugares que não atendem emergência.
    NearbyCategory.HOSPITAL: [7321, 9956],
    NearbyCategory.DESCANSO: [7314, 7311],
    # Área de serviço, posto, café.
    NearbyCategory.PARADA: [7395, 7311, 9376],
}

# Categoria da TomTom → categoria do app. Subcategorias têm 7 dígitos e
# começam pelos 4 da categoria (7315081 é um tipo de restaurante).
_CATALOG_CATEGORY: dict[str, PlaceCategory] = {
    "7311": PlaceCategory.FUEL,
    "7315": PlaceCategory.FOOD,
    "9376": PlaceCategory.FOOD,
    "9359": PlaceCategory.FOOD,
    "7369": PlaceCategory.PARKING,
    "7313": PlaceCategory.PARKING,
}


class PlaceSearchUnavailable(Exception):
    """A busca por texto não respondeu; a API responde só com os salvos."""


class TomTomPlaceSearch:
    id = "tomtom"

    def __init__(self, client: httpx.AsyncClient, api_key: str) -> None:
        self._client = client
        self._api_key = api_key

    async def search(self, query: str, near: Coordinate | None, limit: int) -> list[Place]:
        params: dict[str, Any] = {
            "key": self._api_key,
            "limit": limit,
            # Aceita palavra pela metade (funciona como autocompletar).
            "typeahead": "true",
            **_LOCALE,
        }
        if near:
            # Sem `radius`, a posição só dá preferência aos lugares perto, sem excluir os longe.
            params |= {"lat": near.latitude, "lon": near.longitude}

        payload = await _get(
            self._client, f"{BASE_URL}/search/{quote(query, safe='')}.json", params
        )
        return [p for p in map(_to_place, payload.get("results") or []) if p]


class TomTomNearbyProvider:
    id = "tomtom"

    def __init__(self, client: httpx.AsyncClient, api_key: str) -> None:
        self._client = client
        self._api_key = api_key

    async def search(
        self, category: NearbyCategory, center: Coordinate, radius_meters: float, limit: int
    ) -> list[Candidate]:
        try:
            payload = await _get(
                self._client,
                f"{BASE_URL}/nearbySearch/.json",
                {
                    "key": self._api_key,
                    "lat": center.latitude,
                    "lon": center.longitude,
                    "radius": int(radius_meters),
                    "limit": limit,
                    "categorySet": ",".join(map(str, NEARBY_CATEGORIES[category])),
                    **_LOCALE,
                },
            )
        except PlaceSearchUnavailable as error:
            raise NearbyUnavailable(str(error)) from error

        return [
            candidate
            for candidate in (_to_candidate(raw, category) for raw in payload.get("results") or [])
            if candidate
        ]


async def _get(client: httpx.AsyncClient, url: str, params: dict[str, Any]) -> dict[str, Any]:
    try:
        response = await client.get(url, params=params)
    except httpx.HTTPError as error:
        # Só o nome da exceção: a mensagem pode ter a URL, e a URL tem a chave.
        raise PlaceSearchUnavailable(f"TomTom sem resposta ({type(error).__name__})") from error

    if response.is_error:
        # 403 = chave inválida ou limite do plano; 429 = muitas chamadas por segundo.
        raise PlaceSearchUnavailable(f"TomTom respondeu {response.status_code}")

    try:
        payload = response.json()
    except ValueError as error:
        raise PlaceSearchUnavailable("TomTom devolveu um corpo inválido") from error

    if not isinstance(payload, dict):
        raise PlaceSearchUnavailable("TomTom devolveu um corpo inválido")

    return payload


def _to_place(raw: Any) -> Place | None:
    point = _point(raw)
    if point is None:
        return None

    address = raw.get("address") or {}
    poi = raw.get("poi") or {}

    if raw.get("type") == "POI" and poi.get("name"):
        # Ex.: "Shopping Iguatemi Campinas" / "Avenida Iguatemi, 777, Campinas"
        name = poi["name"]
        detail = _join(_street(address), address.get("municipality"))
        category = _catalog_category(poi)
    else:
        # Endereço, rua ou cidade: o próprio endereço vira o nome.
        name = _street(address) or address.get("freeformAddress")
        detail = _join(
            address.get("municipalitySubdivision"),
            address.get("municipality"),
            address.get("countrySubdivisionCode"),
        )
        category = PlaceCategory.OTHER

    if not name:
        return None

    return Place(
        id=f"tomtom:{raw.get('id')}",
        name=name,
        address=detail or address.get("freeformAddress") or "",
        category=category,
        latitude=point.latitude,
        longitude=point.longitude,
    )


def _to_candidate(raw: Any, category: NearbyCategory) -> Candidate | None:
    point = _point(raw)
    name = (raw.get("poi") or {}).get("name") if isinstance(raw, dict) else None

    if point is None or not name:
        return None

    if category is NearbyCategory.HOSPITAL and not _is_emergency_care(raw):
        return None

    address = raw.get("address") or {}
    return Candidate(
        id=f"tomtom:{raw.get('id')}",
        name=name,
        address=_street(address) or address.get("freeformAddress"),
        location=point,
    )


def _is_emergency_care(raw: Any) -> bool:
    """Na lista de emergência só entram hospital ou pronto-socorro."""
    if not isinstance(raw, dict):
        return False

    category_set = (raw.get("poi") or {}).get("categorySet") or []
    ids = [str(item.get("id", "")) for item in category_set if isinstance(item, dict)]
    # 7321 = hospitais (e subcategorias); 9956 = pronto-socorro.
    return any(category_id.startswith(("7321", "9956")) for category_id in ids)


def _point(raw: Any) -> Coordinate | None:
    """
    Usa a entrada principal do lugar, quando existir; senão, o centro.

    Num shopping ou hospital, o centro fica no meio do terreno e a rota
    terminaria numa rua de trás. A entrada é onde o carro chega.
    """
    if not isinstance(raw, dict):
        return None

    entries = raw.get("entryPoints") or []
    main = next((e for e in entries if isinstance(e, dict) and e.get("type") == "main"), None)
    position = (main or {}).get("position") or raw.get("position") or {}
    latitude, longitude = position.get("lat"), position.get("lon")

    if not isinstance(latitude, int | float) or not isinstance(longitude, int | float):
        return None

    return Coordinate(latitude=latitude, longitude=longitude)


def _street(address: dict[str, Any]) -> str | None:
    street, number = address.get("streetName"), address.get("streetNumber")
    return f"{street}, {number}" if street and number else street


def _join(*parts: str | None) -> str:
    seen: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    return ", ".join(seen)


def _catalog_category(poi: dict[str, Any]) -> PlaceCategory:
    for entry in poi.get("categorySet") or []:
        category = _CATALOG_CATEGORY.get(str(entry.get("id", ""))[:4])
        if category:
            return category
    return PlaceCategory.OTHER
