from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from fastapi.exceptions import RequestValidationError

from reint_backend import analysis
from reint_backend.config import settings
from reint_backend.dataset import Dataset, Mode
from reint_backend.metrics import error_stats
from reint_backend.models import to_utc_iso
from reint_backend.schemas import (
    MAX_HORIZON_HOURS,
    ActualPoint,
    BreakdownResponse,
    DataQuality,
    Distribution,
    DistributionResponse,
    ForecastPoint,
    HorizonPoint,
    HorizonResponse,
    HourBreakdown,
    LevelBreakdown,
    MetaResponse,
    MetricsResponse,
    SelectionQuery,
    SeriesResponse,
    Stats,
    Window,
    WindowQuery,
)

router = APIRouter(prefix="/api")


@lru_cache(maxsize=1)
def get_dataset() -> Dataset:
    return Dataset.load(settings.db_path, settings)


DatasetDep = Annotated[Dataset, Depends(get_dataset)]


@dataclass(frozen=True)
class Selection:
    ds: Dataset
    start: datetime
    end: datetime
    mode: Mode
    horizon: int

    @property
    def window(self) -> Window:
        horizon = self.horizon if self.mode is Mode.HORIZON else None
        return Window(start=self.start, end=self.end, mode=self.mode, horizon_hours=horizon)


def _window_bounds(q: WindowQuery, ds: Dataset) -> tuple[datetime, datetime]:
    """Fill defaults from the data and reject windows the data doesn't cover, in the same
    error shape FastAPI uses for its own validation."""
    start, end = q.start or ds.start, q.end or ds.end
    available = f"data covers {to_utc_iso(ds.start)} to {to_utc_iso(ds.end)}"
    errors: list[dict[str, Any]] = []
    if not ds.start <= start < ds.end:
        errors.append(_error("start", f"start is outside the available range: {available}"))
    if not ds.start < end <= ds.end:
        errors.append(_error("end", f"end is outside the available range: {available}"))
    if not errors and start >= end:
        errors.append(_error("start", "start must be before end"))
    if errors:
        raise RequestValidationError(errors)
    return start, end


def _error(field: str, msg: str) -> dict[str, Any]:
    return {"type": "value_error", "loc": ("query", field), "msg": msg, "input": None}


def resolve_window(
    q: Annotated[WindowQuery, Query()], ds: DatasetDep
) -> tuple[Dataset, datetime, datetime]:
    return ds, *_window_bounds(q, ds)


def resolve_selection(q: Annotated[SelectionQuery, Query()], ds: DatasetDep) -> Selection:
    start, end = _window_bounds(q, ds)
    return Selection(ds, start, end, q.mode, q.horizon)


SelectionDep = Annotated[Selection, Depends(resolve_selection)]


@router.get("/series", tags=["forecasts"], summary="Actual and forecast generation over time")
def series(sel: SelectionDep) -> SeriesResponse:
    """Half-hourly actual wind generation, and for each hour the forecast that counts under
    the chosen mode."""
    forecasts = sel.ds.select(sel.mode, sel.horizon, sel.start, sel.end)
    return SeriesResponse(
        window=sel.window,
        actual=[
            ActualPoint(time=a.start_time, generation_mw=a.generation)
            for a in sel.ds.actuals_between(sel.start, sel.end)
        ],
        forecast=[
            ForecastPoint(
                target_time=f.start_time,
                publish_time=f.publish_time,
                horizon_hours=f.horizon_hours,
                generation_mw=f.generation,
            )
            for f in forecasts
        ],
    )


@router.get("/metrics", tags=["accuracy"], summary="Headline accuracy for a window")
def metrics(sel: SelectionDep) -> MetricsResponse:
    points = sel.ds.error_points(sel.mode, sel.horizon, sel.start, sel.end)
    stats = Stats.model_validate(error_stats(points)) if points else None
    return MetricsResponse(window=sel.window, stats=stats)


@router.get("/analysis/horizon", tags=["accuracy"], summary="Error against forecast horizon")
def horizon_curve(
    resolved: Annotated[tuple[Dataset, datetime, datetime], Depends(resolve_window)],
) -> HorizonResponse:
    """Horizon-mode accuracy at every whole hour from 0 to 48 h."""
    ds, start, end = resolved
    # Pairing only scores targets that have an actual, so limiting the actuals to the
    # window limits the whole curve to it.
    curve = analysis.error_by_horizon(
        ds.book, ds.actual_by_time(start, end), range(MAX_HORIZON_HOURS + 1)
    )
    return HorizonResponse(
        start=start, end=end, points=[HorizonPoint.model_validate(h) for h in curve]
    )


@router.get("/analysis/distribution", tags=["accuracy"], summary="How forecast errors are spread")
def distribution(
    sel: SelectionDep,
    bin_width: Annotated[
        int, Query(ge=50, le=5000, description="Histogram bin width in MW.")
    ] = 500,
) -> DistributionResponse:
    points = sel.ds.error_points(sel.mode, sel.horizon, sel.start, sel.end)
    dist = (
        Distribution.model_validate(analysis.error_distribution(points, bin_width))
        if points
        else None
    )
    return DistributionResponse(window=sel.window, bin_width_mw=bin_width, distribution=dist)


@router.get("/analysis/breakdown", tags=["accuracy"], summary="Error by time of day and wind level")
def breakdown(sel: SelectionDep) -> BreakdownResponse:
    """Accuracy for each UK local hour of day, and for each band of forecast output."""
    points = sel.ds.error_points(sel.mode, sel.horizon, sel.start, sel.end)
    return BreakdownResponse(
        window=sel.window,
        by_hour=[
            HourBreakdown.model_validate(h) for h in analysis.breakdown_by_hour(points, sel.ds.tz)
        ],
        by_level=[LevelBreakdown.model_validate(lv) for lv in analysis.breakdown_by_level(points)],
    )


@router.get("/meta", tags=["meta"], summary="What data is loaded")
def meta(ds: DatasetDep) -> MetaResponse:
    q = ds.meta.get("quality")
    return MetaResponse(
        available_start=ds.start,
        available_end=ds.end,
        ingested_at=ds.meta.get("ingested_at"),
        source=ds.meta.get("source"),
        actual_half_hours=len(ds.actuals),
        forecast_runs=ds.forecast_runs,
        target_hours=len(ds.book.targets),
        max_horizon_hours=MAX_HORIZON_HOURS,
        day_ahead_cutoff_local=ds.day_ahead_cutoff.strftime("%H:%M"),
        timezone=ds.tz.key,
        quality=DataQuality(
            actual_slots_expected=q["actual_slots_expected"],
            actual_slots_missing=len(q["actual_slots_missing"]),
            target_hours_without_forecast=len(q["target_hours_without_forecast"]),
            forecast_rows_dropped_negative_horizon=q["forecast_rows_dropped_negative_horizon"],
            off_schedule_runs=q["off_schedule_runs"],
        )
        if q
        else None,
    )
