from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from reint_backend.config import settings

app = FastAPI(title="Reint Wind Forecast API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
