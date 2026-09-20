"""
Configuração da API do Atlas.

Tudo que varia entre ambientes — URL do Supabase, chave de serviço, provider de
rotas ativo, TTL do cache — entra por variável de ambiente e é lido uma única
vez. Nenhum módulo lê `os.environ` diretamente.

A razão de existir deste backend está aqui: **chaves de API ficam do lado do
servidor**. O aplicativo nunca precisa embarcar credencial de Supabase, de
Google Routes ou de qualquer provider.
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
    # A chave de serviço ignora RLS de propósito: é ela que lê e escreve o
    # `route_cache`, que não tem policy nenhuma. Nunca sai deste processo.
    supabase_url: HttpUrl
    supabase_service_key: str = Field(min_length=20, repr=False)

    # --- Rotas ----------------------------------------------------------
    route_provider: Literal["osrm"] = "osrm"
    osrm_base_url: HttpUrl = HttpUrl("https://router.project-osrm.org")

    # Quanto tempo uma rota calculada continua válida. Trânsito não entra no
    # cálculo do OSRM, então a geometria envelhece devagar — uma hora é
    # conservador e já elimina a maior parte das chamadas repetidas.
    route_cache_ttl_seconds: int = Field(default=3_600, ge=0)

    # Timeout de qualquer chamada de saída, espelhando os 12 s de `utils/http.ts`.
    outbound_timeout_seconds: float = Field(default=12.0, gt=0)

    # --- Lugares -------------------------------------------------------
    # Chave da TomTom Search (plano Freemium, sem cartão). Com ela, a busca
    # de destino acha qualquer lugar ou endereço, e as opções próximas saem
    # rápidas mesmo sem Google. Vazia, a busca fica só nos lugares salvos.
    tomtom_api_key: SecretStr | None = Field(default=None, repr=False)
    # Consultas à TomTom por dia, somando busca de destino e próximos. O
    # Freemium dá 2.500 por dia; 2.000 deixa folga.
    tomtom_daily_limit: int = Field(default=2_000, ge=0)

    # Chave do Google Places (API New). Opcional: com ela, as opções próximas
    # vêm com nota; sem ela, da TomTom ou do OpenStreetMap, sem nota. Nunca
    # vai para o aplicativo.
    google_places_api_key: SecretStr | None = Field(default=None, repr=False)
    # Consultas ao Google por dia, contadas por esta API. A cota gratuita do
    # plano com nota é de 1.000 por mês (~33 por dia); 30 deixa folga.
    google_places_daily_limit: int = Field(default=30, ge=0)
    overpass_url: HttpUrl = HttpUrl("https://overpass-api.de/api/interpreter")

    # --- Câmera (classificação de imagem) --------------------------------
    # Ligada, a API carrega o CLIP na subida e classifica as fotos do app em
    # Estrada, Posto, Restaurante ou Ponto turístico (RF-16). Desligada — ou
    # sem o extra `vision` instalado — a câmera fica inerte e o resto funciona.
    vision_enabled: bool = True
    vision_model: str = "openai/clip-vit-base-patch32"
    # Validade da URL assinada de uma foto. Uma hora cobre ver o resumo e
    # percorrer o histórico sem deixar link vivo por aí.
    photo_url_ttl_seconds: int = Field(default=3_600, gt=0)

    # --- Emoção na voz ----------------------------------------------------
    # Ligada, a API carrega o modelo dimensional na subida e lê a emoção do
    # áudio de cada comando (RF-15, CA-07). Desligada — ou sem o extra
    # `audio` — o comando é gravado no diário sem emoção.
    voice_emotion_enabled: bool = True
    voice_emotion_model: str = "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim"

    # --- Random Forest --------------------------------------------------
    # Modelo gerado por `ml/train.py`. Ausente, a API sobe mesmo assim e as
    # recomendações respondem `model_unavailable`.
    ml_model_path: Path = _BACKEND_DIR / "ml" / "models" / "decision_rf.joblib"
    # Modo de demonstração: permite trocar as 6 variáveis numa avaliação. É o
    # que torna o Cenário 3 do escopo demonstrável em sala.
    ml_simulation_enabled: bool = True

    # --- Rede -----------------------------------------------------------
    # Em desenvolvimento o app roda no Expo Go, em outro dispositivo da rede.
    cors_allow_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    """Instância única, resolvida na primeira chamada e reaproveitada depois."""
    return Settings()  # pyright: ignore[reportCallIssue] — vêm do ambiente
