"""The ingested dataset, loaded once and held in memory.

January is ~1.5k actuals and ~15k forecast points, so every query is answered from memory in
milliseconds and the API never touches SQLite after startup.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from enum import StrEnum
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from reint_backend import store
from reint_backend.config import Settings
from reint_backend.metrics import ErrorPoint, pair_with_actuals
from reint_backend.models import ActualRecord, ForecastRecord
from reint_backend.selection import ForecastBook


class Mode(StrEnum):
    HORIZON = "horizon"
    DAY_AHEAD = "day_ahead"


@dataclass(frozen=True)
class Dataset:
    start: datetime
    end: datetime
    actuals: list[ActualRecord]
    book: ForecastBook
    forecast_runs: int
    day_ahead_cutoff: time
    tz: ZoneInfo
    meta: dict[str, Any]

    @classmethod
    def from_records(
        cls,
        actuals: Iterable[ActualRecord],
        forecasts: Iterable[ForecastRecord],
        start: datetime,
        end: datetime,
        cfg: Settings,
        meta: dict[str, Any] | None = None,
    ) -> "Dataset":
        forecasts = list(forecasts)
        return cls(
            start=start,
            end=end,
            actuals=sorted(actuals, key=lambda a: a.start_time),
            book=ForecastBook(forecasts),
            forecast_runs=len({f.publish_time for f in forecasts}),
            day_ahead_cutoff=cfg.day_ahead_cutoff,
            tz=ZoneInfo(cfg.market_timezone),
            meta=meta or {},
        )

    @classmethod
    def load(cls, path: Path, cfg: Settings) -> "Dataset":
        """Read the SQLite file. The window comes from the file's own metadata, so the API
        always describes the data it actually has, falling back to the configured window."""
        meta = store.read_meta(path)
        start = datetime.fromisoformat(meta["target_start"]) if "target_start" in meta else None
        end = datetime.fromisoformat(meta["target_end"]) if "target_end" in meta else None
        return cls.from_records(
            store.load_actuals(path),
            store.load_forecasts(path),
            start or cfg.target_start,
            end or cfg.target_end,
            cfg,
            meta,
        )

    def actuals_between(self, start: datetime, end: datetime) -> list[ActualRecord]:
        return [a for a in self.actuals if start <= a.start_time < end]

    def actual_by_time(self, start: datetime, end: datetime) -> dict[datetime, int]:
        return {a.start_time: a.generation for a in self.actuals_between(start, end)}

    def select(
        self, mode: Mode, horizon_hours: int, start: datetime, end: datetime
    ) -> list[ForecastRecord]:
        """The forecast that counts for each target in [start, end), in target order."""
        if mode is Mode.DAY_AHEAD:
            selected = self.book.day_ahead(self.day_ahead_cutoff, self.tz)
        else:
            selected = self.book.by_horizon(timedelta(hours=horizon_hours))
        return [f for t, f in sorted(selected.items()) if start <= t < end]

    def error_points(
        self, mode: Mode, horizon_hours: int, start: datetime, end: datetime
    ) -> list[ErrorPoint]:
        selected = self.select(mode, horizon_hours, start, end)
        return pair_with_actuals(
            {f.start_time: f for f in selected}, self.actual_by_time(start, end)
        )
