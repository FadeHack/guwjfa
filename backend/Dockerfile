FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --no-editable

COPY src ./src
COPY data ./data
RUN uv sync --frozen --no-dev --no-editable

ENV PATH="/app/.venv/bin:$PATH" \
    REINT_DB_PATH=/app/data/wind.sqlite
# Render injects PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn reint_backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
