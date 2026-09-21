# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# Instala uv (gerenciador de pacotes rápido)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copia apenas os arquivos de dependência primeiro (cache de layers)
COPY pyproject.toml uv.lock ./

# Instala dependências (sem extras vision/audio para imagem menor)
RUN uv sync --frozen --no-dev

# Copia o código
COPY app/ ./app/
COPY ml/models/ ./ml/models/

# Porta padrão
EXPOSE 8787

# Comando de inicialização
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8787"]
