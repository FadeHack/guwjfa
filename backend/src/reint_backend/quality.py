from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from itertools import pairwise
from typing import Any

from reint_backend.models import ActualRecord, ForecastRecord, to_utc_iso

HALF_HOUR = timedelta(minutes=30)
# The normal cadence leaves at most 4 h between runs (22:30 -> 02:30 UTC).
MAX_EXPECTED_RUN_GAP = timedelta(hours=4)


@dataclass
class QualityReport:
    actual_slots_expected: int = 0
    actual_slots_present: int = 0
    actual_slots_missing: list[str] = field(default_factory=list)
    actual_duplicates_dropped: int = 0
    forecast_runs: int = 0
    forecast_rows_kept: int = 0
    forecast_duplicates_dropped: int = 0
    forecast_rows_dropped_negative_horizon: int = 0
    forecast_rows_dropped_outside_window: int = 0
    off_schedule_runs: list[str] = field(default_factory=list)
    run_gaps_over_4h: list[str] = field(default_factory=list)
    target_hours_without_forecast: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_clean(self) -> bool:
        return not (
            self.actual_slots_missing or self.run_gaps_over_4h or self.target_hours_without_forecast
        )


def clean(
    actuals: list[ActualRecord],
    forecasts: list[ForecastRecord],
    window_start: datetime,
    window_end: datetime,
) -> tuple[list[ActualRecord], list[ForecastRecord], QualityReport]:
    """Restrict both datasets to the target window, drop what can't be used, and record
    everything that was dropped or looks irregular.

    A forecast row whose target is before its publish time (a negative horizon) is dropped:
    WINDFOR runs repeat recent hours, but a value for the past was never a forecast anyone
    could act on.
    """
    report = QualityReport()

    actual_by_time: dict[datetime, ActualRecord] = {}
    for a in actuals:
        if not window_start <= a.start_time < window_end:
            continue
        if a.start_time in actual_by_time:
            report.actual_duplicates_dropped += 1
        actual_by_time[a.start_time] = a

    expected = _range(window_start, window_end, HALF_HOUR)
    report.actual_slots_expected = len(expected)
    report.actual_slots_present = len(actual_by_time)
    report.actual_slots_missing = [to_utc_iso(t) for t in expected if t not in actual_by_time]

    forecast_by_key: dict[tuple[datetime, datetime], ForecastRecord] = {}
    for f in forecasts:
        if f.start_time < f.publish_time:
            report.forecast_rows_dropped_negative_horizon += 1
            continue
        if not window_start <= f.start_time < window_end:
            report.forecast_rows_dropped_outside_window += 1
            continue
        key = (f.publish_time, f.start_time)
        if key in forecast_by_key:
            report.forecast_duplicates_dropped += 1
        forecast_by_key[key] = f

    runs = sorted({f.publish_time for f in forecasts})
    report.forecast_runs = len(runs)
    report.off_schedule_runs = _off_schedule(runs)
    report.run_gaps_over_4h = [
        f"{to_utc_iso(a)} -> {to_utc_iso(b)}"
        for a, b in pairwise(runs)
        if b - a > MAX_EXPECTED_RUN_GAP
    ]

    covered = {f.start_time for f in forecast_by_key.values()}
    report.target_hours_without_forecast = [
        to_utc_iso(t)
        for t in _range(window_start, window_end, timedelta(hours=1))
        if t not in covered
    ]
    report.forecast_rows_kept = len(forecast_by_key)

    clean_actuals = sorted(actual_by_time.values(), key=lambda a: a.start_time)
    clean_forecasts = sorted(forecast_by_key.values(), key=lambda f: (f.start_time, f.publish_time))
    return clean_actuals, clean_forecasts, report


def _range(start: datetime, end: datetime, step: timedelta) -> list[datetime]:
    out = []
    t = start
    while t < end:
        out.append(t)
        t += step
    return out


def _off_schedule(runs: list[datetime]) -> list[str]:
    """Runs published at a time of day that occurs on fewer than half the days, e.g. a
    one-off 12:25 run replacing the usual 11:30."""
    if not runs:
        return []
    days = len({r.date() for r in runs})
    slot_counts = Counter(r.strftime("%H:%M") for r in runs)
    return [to_utc_iso(r) for r in runs if slot_counts[r.strftime("%H:%M")] < days / 2]
