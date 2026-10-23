from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from reint_backend.selection import ForecastBook, decision_time
from tests.factories import at, forecast

LONDON = ZoneInfo("Europe/London")
CUTOFF = time(9, 20)

# Target 12:00 on 2 Jan, predicted by runs published 6 h, 4 h and 1 h before it.
TARGET = at(36)
RUNS = [
    forecast(TARGET - timedelta(hours=6), TARGET, 6000),
    forecast(TARGET - timedelta(hours=4), TARGET, 4000),
    forecast(TARGET - timedelta(hours=1), TARGET, 1000),
]


def utc(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


@pytest.mark.parametrize(
    ("horizon_h", "expected_mw"),
    [
        (0, 1000),  # newest run of all
        (1, 1000),  # published exactly H before the target counts
        (2, 4000),
        (4, 4000),
        (5, 6000),
        (6, 6000),
    ],
)
def test_horizon_picks_latest_run_at_least_h_old(horizon_h: int, expected_mw: int) -> None:
    selected = ForecastBook(RUNS).by_horizon(timedelta(hours=horizon_h))

    assert selected[TARGET].generation == expected_mw


def test_horizon_leaves_out_targets_with_no_run_old_enough() -> None:
    assert ForecastBook(RUNS).by_horizon(timedelta(hours=7)) == {}


def test_horizon_selects_independently_per_target() -> None:
    later = TARGET + timedelta(hours=1)
    runs = [*RUNS, forecast(TARGET - timedelta(hours=1), later, 1111)]

    selected = ForecastBook(runs).by_horizon(timedelta(hours=2))

    assert selected[TARGET].generation == 4000
    assert selected[later].generation == 1111


def test_input_order_does_not_matter() -> None:
    selected = ForecastBook(reversed(RUNS)).by_horizon(timedelta(hours=2))

    assert selected[TARGET].generation == 4000


def test_latest_at_returns_none_for_unknown_target() -> None:
    assert ForecastBook(RUNS).latest_at(at(0), at(100)) is None


def test_decision_time_is_cutoff_on_previous_day_in_winter() -> None:
    # Any hour of 2 Jan is bought by 09:20 on 1 Jan; UK time equals UTC in winter.
    for hour in (0, 12, 23):
        assert decision_time(utc(2026, 1, 2, hour), CUTOFF, LONDON) == utc(2026, 1, 1, 9, 20)


def test_decision_time_follows_uk_clock_in_summer() -> None:
    # 23:00 UTC on 30 Jun is 00:00 BST on 1 Jul, so it belongs to delivery day 1 Jul and
    # is bought by 09:20 BST on 30 Jun, which is 08:20 UTC.
    assert decision_time(utc(2026, 6, 30, 23), CUTOFF, LONDON) == utc(2026, 6, 30, 8, 20)
    assert decision_time(utc(2026, 6, 30, 22), CUTOFF, LONDON) == utc(2026, 6, 29, 8, 20)


def test_day_ahead_uses_last_run_published_by_the_cutoff() -> None:
    target = utc(2026, 1, 2, 12)
    runs = [
        forecast(utc(2026, 1, 1, 4, 30), target, 4300),
        forecast(utc(2026, 1, 1, 7, 30), target, 7300),
        forecast(utc(2026, 1, 1, 9, 20), target, 9200),  # exactly at the cutoff: allowed
        forecast(utc(2026, 1, 1, 9, 30), target, 9300),  # 10 minutes late
    ]

    selected = ForecastBook(runs).day_ahead(CUTOFF, LONDON)

    assert selected[target].generation == 9200


def test_day_ahead_uses_the_same_deadline_for_every_hour_of_the_day() -> None:
    early, late = utc(2026, 1, 2, 0), utc(2026, 1, 2, 23)
    runs = [
        forecast(utc(2026, 1, 1, 7, 30), early, 1),
        forecast(utc(2026, 1, 1, 7, 30), late, 2),
        # Fresher runs after the deadline, including one well after midnight on D.
        forecast(utc(2026, 1, 1, 11, 30), early, 99),
        forecast(utc(2026, 1, 2, 4, 30), late, 99),
    ]

    selected = ForecastBook(runs).day_ahead(CUTOFF, LONDON)

    assert {t: f.generation for t, f in selected.items()} == {early: 1, late: 2}


def test_day_ahead_falls_back_to_an_older_run_when_the_latest_skips_a_target() -> None:
    target = utc(2026, 1, 2, 23)
    runs = [
        forecast(utc(2026, 1, 1, 4, 30), target, 4300),
        forecast(utc(2026, 1, 1, 7, 30), target - timedelta(hours=1), 7300),
    ]

    selected = ForecastBook(runs).day_ahead(CUTOFF, LONDON)

    assert selected[target].generation == 4300


def test_day_ahead_leaves_out_targets_with_nothing_before_the_cutoff() -> None:
    target = utc(2026, 1, 2, 12)
    runs = [forecast(utc(2026, 1, 1, 9, 30), target)]

    assert ForecastBook(runs).day_ahead(CUTOFF, LONDON) == {}
