"""Accuracy analyses built on forecast selection and the error metrics."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from reint_backend.metrics import (
    ErrorPoint,
    ErrorStats,
    HistogramBin,
    error_stats,
    histogram,
    pair_with_actuals,
    percentile,
)
from reint_backend.selection import ForecastBook

# Default wind-level buckets by forecast output: 0-5, 5-10, 10-15, 15-20 and 20+ GW.
DEFAULT_LEVEL_EDGES_MW = (0, 5000, 10000, 15000, 20000)


@dataclass(frozen=True, slots=True)
class HorizonStats:
    horizon_hours: int
    stats: ErrorStats | None


@dataclass(frozen=True, slots=True)
class Distribution:
    """Spread of forecast errors.

    Since error is forecast minus actual, actual output came in at or above
    `forecast - p90_mw` 90% of the time. That is the buffer a buyer needs to plan around.
    """

    count: int
    bins: list[HistogramBin]
    p10_mw: float
    p50_mw: float
    p90_mw: float


@dataclass(frozen=True, slots=True)
class HourStats:
    hour: int
    stats: ErrorStats | None


@dataclass(frozen=True, slots=True)
class LevelStats:
    lower_mw: int
    upper_mw: int | None
    stats: ErrorStats | None


def error_by_horizon(
    book: ForecastBook, actual_by_time: dict[datetime, int], horizons: Iterable[int]
) -> list[HorizonStats]:
    """Horizon-mode accuracy at each horizon in hours, over every target with a forecast at
    that horizon."""
    out = []
    for h in horizons:
        points = pair_with_actuals(book.by_horizon(timedelta(hours=h)), actual_by_time)
        out.append(HorizonStats(h, error_stats(points) if points else None))
    return out


def error_distribution(points: Sequence[ErrorPoint], bin_width_mw: float) -> Distribution:
    if not points:
        raise ValueError("error_distribution needs at least one point")
    errors = [float(p.error_mw) for p in points]
    return Distribution(
        count=len(errors),
        bins=histogram(errors, bin_width_mw),
        p10_mw=percentile(errors, 10),
        p50_mw=percentile(errors, 50),
        p90_mw=percentile(errors, 90),
    )


def breakdown_by_hour(points: Sequence[ErrorPoint], tz: ZoneInfo) -> list[HourStats]:
    """Accuracy for each local hour of day, 0-23. Hours with no data have `stats` None."""
    groups: dict[int, list[ErrorPoint]] = {h: [] for h in range(24)}
    for p in points:
        groups[p.target_time.astimezone(tz).hour].append(p)
    return [HourStats(h, error_stats(g) if g else None) for h, g in groups.items()]


def breakdown_by_level(
    points: Sequence[ErrorPoint], edges_mw: Sequence[int] = DEFAULT_LEVEL_EDGES_MW
) -> list[LevelStats]:
    """Accuracy by how much wind was forecast. The last bucket is open-ended.

    Bucketed on the forecast, which is what the trader sees at decision time. Bucketing on
    actuals would bias it: very windy outcomes are mostly under-forecasts by construction.
    """
    if not edges_mw or list(edges_mw) != sorted(set(edges_mw)):
        raise ValueError("edges_mw must be strictly increasing")
    groups: list[list[ErrorPoint]] = [[] for _ in edges_mw]
    for p in points:
        for i in reversed(range(len(edges_mw))):
            if p.forecast_mw >= edges_mw[i]:
                groups[i].append(p)
                break
    uppers: list[int | None] = [*edges_mw[1:], None]
    return [
        LevelStats(lo, hi, error_stats(g) if g else None)
        for lo, hi, g in zip(edges_mw, uppers, groups, strict=True)
    ]
