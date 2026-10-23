from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from reint_backend.api import get_dataset, router
from reint_backend.config import settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Load before taking traffic, so the first visitor after a cold start doesn't wait on it.
    get_dataset()
    yield


app = FastAPI(
    title="Reint Wind Forecast API",
    version="0.1.0",
    description="UK national wind generation: actual output against the forecasts that were "
    "available when day-ahead purchase decisions were made, and how accurate those forecasts "
    "were. Source: Elexon BMRS (FUELHH and WINDFOR). All times are UTC.",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "forecasts", "description": "Time series for charting."},
        {"name": "accuracy", "description": "Error metrics and analyses."},
        {"name": "meta", "description": "Dataset coverage and health."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(router)


@app.get("/api/health", tags=["meta"], summary="Liveness check")
def health() -> dict[str, str]:
    return {"status": "ok"}
