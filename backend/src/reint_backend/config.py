from datetime import datetime, time
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="REINT_", env_file=".env")

    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    # Comma-separated so it can be set from a single env var on Render.
    cors_origins: str = "http://localhost:5173"
    db_path: Path = BACKEND_ROOT / "data" / "wind.sqlite"

    # Delivery days 1 Jan to 1 Feb 2026: every day whose purchase decision falls in January
    # (D-1), plus 1 Jan so the month of targets is complete. End is exclusive.
    target_start: datetime = datetime.fromisoformat("2026-01-01T00:00:00Z")
    target_end: datetime = datetime.fromisoformat("2026-02-02T00:00:00Z")
    # Forecast runs reach ~66 h ahead, so 72 h before the first target captures every run
    # that says anything about it.
    forecast_lookback_hours: int = 72

    # Day-ahead purchase deadline on D-1, in market local time. 09:20 is EPEX SPOT GB gate
    # closure, the earlier of the two GB day-ahead auctions (N2EX closes at 09:50).
    day_ahead_cutoff: time = time(9, 20)
    market_timezone: str = "Europe/London"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
