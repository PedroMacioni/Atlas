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
from typing import Literal

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # --- Rede -----------------------------------------------------------
    # Em desenvolvimento o app roda no Expo Go, em outro dispositivo da rede.
    cors_allow_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    """Instância única, resolvida na primeira chamada e reaproveitada depois."""
    return Settings()  # pyright: ignore[reportCallIssue] — vêm do ambiente
