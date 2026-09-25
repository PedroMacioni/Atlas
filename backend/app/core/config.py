"""
Configurações da API.

Tudo que muda entre ambientes (URL do banco, chaves, limites) vem de
variáveis de ambiente com prefixo `ATLAS_`, lidas do `.env` uma única vez.
As chaves ficam só no servidor, nunca no aplicativo.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, HttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="ATLAS_",
        extra="ignore",
    )

    environment: Literal["development", "staging", "production"] = "development"

    # --- Supabase -------------------------------------------------------
    # Chave de serviço do Supabase: tem acesso total ao banco (ignora RLS).
    # Nunca sai deste servidor.
    supabase_url: HttpUrl
    supabase_service_key: str = Field(min_length=20, repr=False)

    # --- Rotas ----------------------------------------------------------
    route_provider: Literal["osrm"] = "osrm"
    osrm_base_url: HttpUrl = HttpUrl("https://router.project-osrm.org")

    # Por quanto tempo uma rota fica válida no cache. O OSRM não considera
    # trânsito, então uma hora é um valor seguro.
    route_cache_ttl_seconds: int = Field(default=3_600, ge=0)

    # Tempo máximo de qualquer chamada externa (igual aos 12 s do app).
    outbound_timeout_seconds: float = Field(default=12.0, gt=0)

    # --- Lugares -------------------------------------------------------
    # Chave da TomTom (plano grátis). Com ela a busca acha qualquer endereço.
    # Sem ela, a busca fica só nos lugares salvos.
    tomtom_api_key: SecretStr | None = Field(default=None, repr=False)
    # Consultas à TomTom por dia (o plano grátis dá 2.500).
    tomtom_daily_limit: int = Field(default=2_000, ge=0)

    # Chave do Google Places (opcional). Com ela os lugares próximos vêm com
    # nota; sem ela vêm da TomTom ou do OpenStreetMap, sem nota.
    google_places_api_key: SecretStr | None = Field(default=None, repr=False)
    # Consultas ao Google por dia. O plano com nota dá ~33 por dia grátis.
    google_places_daily_limit: int = Field(default=30, ge=0)
    overpass_url: HttpUrl = HttpUrl("https://overpass-api.de/api/interpreter")

    # --- Câmera (classificação de imagem) --------------------------------
    # Liga o CLIP, que classifica as fotos em Estrada, Posto, Restaurante ou
    # Ponto turístico (RF-16). Sem o extra `vision` instalado, fica desligado.
    vision_enabled: bool = True
    vision_model: str = "openai/clip-vit-base-patch32"
    # Validade (em segundos) do link temporário de cada foto.
    photo_url_ttl_seconds: int = Field(default=3_600, gt=0)

    # --- Emoção na voz ----------------------------------------------------
    # Liga o modelo que lê a emoção da voz (RF-15). Sem o extra `audio`
    # instalado, o comando é gravado sem emoção.
    voice_emotion_enabled: bool = True
    voice_emotion_model: str = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"

    # --- Random Forest --------------------------------------------------
    # Arquivo do modelo gerado por `ml/train.py`. Se não existir, a API sobe
    # e as recomendações respondem `model_unavailable`.
    ml_model_path: Path = _BACKEND_DIR / "ml" / "models" / "decision_rf.joblib"
    # Permite o modo de simulação (trocar as 6 variáveis na apresentação).
    ml_simulation_enabled: bool = True

    # --- Rede -----------------------------------------------------------
    # Em desenvolvimento o app roda em outro aparelho da rede, então libera tudo.
    cors_allow_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    """Lê as configurações uma vez e reaproveita nas próximas chamadas."""
    return Settings()  # pyright: ignore[reportCallIssue] — vêm do ambiente
