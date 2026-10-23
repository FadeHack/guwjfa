"""Forecast error metrics.

Error is always forecast minus actual, in MW. Positive means the forecast promised more wind
than turned up, which is the costly direction for a buyer: they bought too little and have to
cover the gap at short notice.
"""

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

from reint_backend.models import ForecastRecord


@dataclass(frozen=True, slots=True)
class ErrorPoint:
    target_time: datetime
    publish_time: datetime
    actual_mw: int
    forecast_mw: int

    @property
    def error_mw(self) -> int:
        return self.forecast_mw - self.actual_mw

    @property
    def horizon_hours(self) -> float:
        return (self.target_time - self.publish_time).total_seconds() / 3600


@dataclass(frozen=True, slots=True)
class ErrorStats:
    count: int
    mae_mw: float
    rmse_mw: float
    bias_mw: float
    # MAE as a fraction of mean actual output. None when actual output sums to zero.
    nmae: float | None


@dataclass(frozen=True, slots=True)
class HistogramBin:
    lower_mw: float
    upper_mw: float
    count: int


def pair_with_actuals(
    selected: Mapping[datetime, ForecastRecord], actual_by_time: Mapping[datetime, int]
) -> list[ErrorPoint]:
    """Match each selected forecast with the actual for the half-hour starting at the same
    time. Targets without an actual are skipped."""
    return [
        ErrorPoint(target, f.publish_time, actual_by_time[target], f.generation)
        for target, f in sorted(selected.items())
        if target in actual_by_time
    ]


def error_stats(points: Sequence[ErrorPoint]) -> ErrorStats:
    """Headline accuracy for a set of forecasts.

    Normalised MAE is total absolute error over total actual output. Per-point MAPE blows up on
    calm hours when output is near zero; this ratio stays stable.
    """
    if not points:
        raise ValueError("error_stats needs at least one point")
    errors = [p.error_mw for p in points]
    n = len(errors)
    abs_total = sum(abs(e) for e in errors)
    actual_total = sum(p.actual_mw for p in points)
    return ErrorStats(
        count=n,
        mae_mw=abs_total / n,
        rmse_mw=math.sqrt(sum(e * e for e in errors) / n),
        bias_mw=sum(errors) / n,
        nmae=abs_total / actual_total if actual_total else None,
    )


def percentile(values: Sequence[float], q: float) -> float:
    """The q-th percentile (0-100) with linear interpolation between closest ranks, the same
    definition as numpy's default."""
    if not values:
        raise ValueError("percentile needs at least one value")
    if not 0 <= q <= 100:
        raise ValueError("q must be between 0 and 100")
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q / 100
    lo = math.floor(pos)
    hi = min(lo + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (pos - lo)


def histogram(values: Sequence[float], bin_width: float) -> list[HistogramBin]:
    """Counts in fixed-width bins aligned to multiples of `bin_width`, so bin edges are round
    numbers. Each bin includes its lower edge and excludes its upper edge. Empty bins inside
    the range are kept so the chart has no holes."""
    if bin_width <= 0:
        raise ValueError("bin_width must be positive")
    if not values:
        return []
    first = math.floor(min(values) / bin_width)
    last = math.floor(max(values) / bin_width)
    counts = [0] * (last - first + 1)
    for v in values:
        counts[math.floor(v / bin_width) - first] += 1
    return [
        HistogramBin((first + i) * bin_width, (first + i + 1) * bin_width, c)
        for i, c in enumerate(counts)
    ]
