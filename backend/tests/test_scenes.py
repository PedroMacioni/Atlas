"""
A câmera no diário de bordo (RF-16, RF-22, CA-06).

Sem CLIP e sem rede: o classificador é um dublê que devolve a classe que o
teste mandar. O que se verifica aqui é a regra em volta dele — o que vira
evento, o que vira foto guardada e o que é descartado por não dizer nada novo.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from app.core.errors import InvalidImageError, TripAlreadyFinished, VisionUnavailableError
from app.schemas.coordinate import Coordinate
from app.schemas.scene import ScenePurpose
from app.services.scene_service import SceneService
from app.vision.scene_classifier import InvalidImage, SceneReading, VisionUnavailable
from tests.test_trips import DEVICE, FakeTripRepository

NOW = datetime(2026, 9, 20, 14, 30, tzinfo=UTC)
HERE = Coordinate(latitude=-22.8616, longitude=-47.0452)
JPEG = b"\xff\xd8\xff\xe0 uma foto"


class FakeClassifier:
    """Devolve a leitura programada — ou levanta o que for pedido."""

    def __init__(self, reading: SceneReading | None = None, raises: Exception | None = None):
        self.reading = reading or SceneReading("estrada", 0.97, {"estrada": 0.97})
        self.raises = raises
        self.calls = 0

    @property
    def ready(self) -> bool:
        return True

    async def classify(self, image: bytes) -> SceneReading:
        self.calls += 1
        if self.raises:
            raise self.raises
        return self.reading


@pytest.fixture
def repository() -> FakeTripRepository:
    return FakeTripRepository()


async def start_trip(repository: FakeTripRepository) -> UUID:
    device_id = await repository.ensure_device(DEVICE)
    trip = await repository.create_trip(
        {
            "device_id": str(device_id),
            "origin_name": "Sua localização",
            "origin_latitude": -22.9056,
            "origin_longitude": -47.0608,
            "destination_name": "Faculdade Anhanguera",
            "destination_latitude": -22.8616,
            "destination_longitude": -47.0452,
            "started_at": (NOW - timedelta(hours=1)).isoformat(),
        }
    )
    return UUID(trip["id"])


def build(repository, classifier, *, now=NOW) -> SceneService:
    return SceneService(repository, classifier, photo_url_ttl_seconds=3_600, clock=lambda: now)


async def classify(service, trip_id, *, purpose=ScenePurpose.CONTEXT, location=HERE):
    return await service.classify(DEVICE, trip_id, image=JPEG, purpose=purpose, location=location)


async def test_leitura_automatica_vira_evento_sem_guardar_a_foto(repository):
    trip_id = await start_trip(repository)
    classifier = FakeClassifier(SceneReading("posto", 0.88, {"posto": 0.88}))

    result = await classify(build(repository, classifier), trip_id)

    assert (result.image_class, result.recorded) == ("posto", True)
    assert repository.uploads == [] and repository.photos == []

    [event] = [e for e in repository.events if e["kind"] == "scene"]
    assert event["image_class"] == "posto"
    assert event["image_confidence"] == 0.88
    assert event["command"] == "Câmera: posto de combustível"
    assert (event["latitude"], event["longitude"]) == (HERE.latitude, HERE.longitude)


async def test_mesma_cena_nao_vira_evento_de_novo(repository):
    trip_id = await start_trip(repository)
    service = build(repository, FakeClassifier())

    first = await classify(service, trip_id)
    second = await classify(service, trip_id)

    assert first.recorded is True
    assert (second.recorded, second.reason) == (False, "unchanged")
    assert len([e for e in repository.events if e["kind"] == "scene"]) == 1


async def test_cena_igual_mas_velha_renova_a_leitura_do_modelo(repository):
    trip_id = await start_trip(repository)

    await classify(build(repository, FakeClassifier()), trip_id)
    later = await classify(
        build(repository, FakeClassifier(), now=NOW + timedelta(minutes=21)), trip_id
    )

    assert later.recorded is True
    assert len([e for e in repository.events if e["kind"] == "scene"]) == 2


async def test_cena_que_muda_vira_evento_e_pode_disparar_a_avaliacao(repository):
    trip_id = await start_trip(repository)

    await classify(build(repository, FakeClassifier()), trip_id)
    changed = await classify(
        build(repository, FakeClassifier(SceneReading("restaurante", 0.8, {}))), trip_id
    )

    assert changed.recorded is True
    assert [e["image_class"] for e in repository.events if e["kind"] == "scene"] == [
        "estrada",
        "restaurante",
    ]


async def test_confianca_baixa_nao_suja_o_diario(repository):
    trip_id = await start_trip(repository)
    classifier = FakeClassifier(SceneReading("restaurante", 0.31, {"restaurante": 0.31}))

    result = await classify(build(repository, classifier), trip_id)

    assert (result.recorded, result.reason) == (False, "low_confidence")
    assert repository.events == []


async def test_ponto_turistico_guarda_a_foto_e_devolve_a_url(repository):
    trip_id = await start_trip(repository)
    classifier = FakeClassifier(SceneReading("ponto_turistico", 0.99, {"ponto_turistico": 0.99}))

    result = await classify(
        build(repository, classifier), trip_id, purpose=ScenePurpose.TOURIST_SPOT
    )

    assert result.recorded is True
    assert result.photo is not None
    assert result.photo.url.startswith("https://storage.test/")
    assert result.photo.image_class == "ponto_turistico"

    [(path, content)] = repository.uploads
    assert path.startswith(f"{trip_id}/") and path.endswith(".jpg")
    assert content == JPEG

    [event] = [e for e in repository.events if e["kind"] == "tourist_spot"]
    assert event["command"] == "Registrar ponto turístico"
    assert repository.photos[0]["trip_event_id"] == event["id"]


async def test_ponto_turistico_e_gravado_mesmo_com_confianca_baixa(repository):
    """Quem mandou registrar foi o usuário; a classe é palpite, o registro não."""
    trip_id = await start_trip(repository)
    classifier = FakeClassifier(SceneReading("estrada", 0.28, {"estrada": 0.28}))

    result = await classify(
        build(repository, classifier), trip_id, purpose=ScenePurpose.TOURIST_SPOT
    )

    assert result.recorded is True and result.photo is not None


async def test_arquivo_que_nao_e_imagem_vira_erro_de_dominio(repository):
    trip_id = await start_trip(repository)
    classifier = FakeClassifier(raises=InvalidImage("não é imagem"))

    with pytest.raises(InvalidImageError):
        await classify(build(repository, classifier), trip_id)


async def test_classificador_carregando_avisa_em_vez_de_travar(repository):
    trip_id = await start_trip(repository)
    classifier = FakeClassifier(raises=VisionUnavailable("carregando"))

    with pytest.raises(VisionUnavailableError):
        await classify(build(repository, classifier), trip_id)


async def test_sem_classificador_a_camera_fica_inerte(repository):
    trip_id = await start_trip(repository)

    with pytest.raises(VisionUnavailableError):
        await classify(build(repository, None), trip_id)


async def test_viagem_encerrada_nao_aceita_foto(repository):
    trip_id = await start_trip(repository)
    repository.trips[str(trip_id)]["ended_at"] = NOW.isoformat()

    with pytest.raises(TripAlreadyFinished):
        await classify(build(repository, FakeClassifier()), trip_id)


async def test_viagem_de_outro_aparelho_nao_existe(repository):
    trip_id = await start_trip(repository)
    service = build(repository, FakeClassifier())

    with pytest.raises(Exception) as failure:
        await service.classify(
            uuid4(), trip_id, image=JPEG, purpose=ScenePurpose.CONTEXT, location=None
        )

    assert failure.value.__class__.__name__ == "TripNotFound"


async def test_foto_do_ponto_turistico_aparece_no_detalhe_da_viagem(repository):
    """O caminho inteiro: registrar, encerrar e ver a foto no resumo (CA-14)."""
    from app.services.trip_service import TripService

    trip_id = await start_trip(repository)
    classifier = FakeClassifier(SceneReading("ponto_turistico", 0.95, {}))
    await classify(build(repository, classifier), trip_id, purpose=ScenePurpose.TOURIST_SPOT)

    detail = await TripService(repository).get(DEVICE, trip_id)

    [photo] = detail.photos
    assert photo.image_class == "ponto_turistico"
    assert photo.url.startswith("https://storage.test/")
    assert photo.location == HERE
