from datetime import timedelta

from reint_backend.models import ActualRecord, ForecastRecord
from reint_backend.quality import clean
from tests.factories import actual, at, forecast

WINDOW = (at(0), at(2))


def full_actuals() -> list[ActualRecord]:
    return [actual(at(h / 2)) for h in range(4)]


def full_forecasts() -> list[ForecastRecord]:
    return [forecast(at(-1), at(0)), forecast(at(-1), at(1))]


def test_clean_data_reports_no_issues() -> None:
    actuals, forecasts, report = clean(full_actuals(), full_forecasts(), *WINDOW)

    assert len(actuals) == 4
    assert len(forecasts) == 2
    assert report.actual_slots_expected == 4
    assert report.is_clean


def test_drops_negative_horizon_rows() -> None:
    past = forecast(at(1), at(0))

    _, forecasts, report = clean(full_actuals(), [*full_forecasts(), past], *WINDOW)

    assert past not in forecasts
    assert report.forecast_rows_dropped_negative_horizon == 1


def test_zero_horizon_is_kept() -> None:
    same_time = forecast(at(1), at(1))

    _, forecasts, _ = clean(full_actuals(), [*full_forecasts(), same_time], *WINDOW)

    assert same_time in forecasts


def test_drops_rows_outside_window() -> None:
    late_actual = actual(at(2))
    late_forecast = forecast(at(-1), at(2))

    actuals, forecasts, report = clean(
        [*full_actuals(), late_actual], [*full_forecasts(), late_forecast], *WINDOW
    )

    assert late_actual not in actuals
    assert late_forecast not in forecasts
    assert report.forecast_rows_dropped_outside_window == 1


def test_dedupes_and_counts_duplicates() -> None:
    actuals, forecasts, report = clean(
        [*full_actuals(), actual(at(0))], [*full_forecasts(), forecast(at(-1), at(0))], *WINDOW
    )

    assert len(actuals) == 4
    assert len(forecasts) == 2
    assert report.actual_duplicates_dropped == 1
    assert report.forecast_duplicates_dropped == 1


def test_reports_missing_actuals_and_uncovered_hours() -> None:
    _, _, report = clean(full_actuals()[:-1], full_forecasts()[:1], *WINDOW)

    assert report.actual_slots_missing == ["2026-01-01T01:30:00Z"]
    assert report.target_hours_without_forecast == ["2026-01-01T01:00:00Z"]
    assert not report.is_clean


def test_flags_runs_outside_the_daily_schedule() -> None:
    runs = [at(d * 24 + 2.5) for d in range(4)] + [at(24 + 12 + 25 / 60)]
    forecasts = [forecast(r, r + timedelta(hours=1)) for r in runs]

    _, _, report = clean([], forecasts, at(0), at(24 * 5))

    assert report.off_schedule_runs == ["2026-01-02T12:25:00Z"]


def test_flags_gaps_between_runs_longer_than_4h() -> None:
    runs = [at(0), at(2), at(6), at(10.5)]
    forecasts = [forecast(r, r + timedelta(hours=1)) for r in runs]

    _, _, report = clean([], forecasts, at(0), at(12))

    assert report.run_gaps_over_4h == ["2026-01-01T06:00:00Z -> 2026-01-01T10:30:00Z"]
