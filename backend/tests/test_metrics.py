import math

import pytest

from reint_backend.metrics import (
    ErrorPoint,
    HistogramBin,
    error_stats,
    histogram,
    pair_with_actuals,
    percentile,
)
from tests.factories import at, forecast


def point(actual_mw: int, forecast_mw: int, hour: float = 0) -> ErrorPoint:
    return ErrorPoint(at(hour), at(hour - 4), actual_mw, forecast_mw)


def test_error_is_forecast_minus_actual() -> None:
    p = point(actual_mw=1000, forecast_mw=1300)

    assert p.error_mw == 300
    assert p.horizon_hours == 4


def test_pairing_matches_actual_starting_at_the_target_and_skips_missing() -> None:
    selected = {at(0): forecast(at(-4), at(0), 1300), at(1): forecast(at(-4), at(1), 900)}
    # 00:30 must be ignored: a forecast for 00:00 is compared with 00:00-00:30 only.
    actuals = {at(0): 1000, at(0.5): 5000}

    assert pair_with_actuals(selected, actuals) == [ErrorPoint(at(0), at(-4), 1000, 1300)]


def test_error_stats_hand_computed() -> None:
    # errors +100, -200, +300, -400 against 1000 MW actual each
    points = [point(1000, 1100), point(1000, 800), point(1000, 1300), point(1000, 600)]

    s = error_stats(points)

    assert s.count == 4
    assert s.mae_mw == 250  # (100 + 200 + 300 + 400) / 4
    assert s.rmse_mw == pytest.approx(math.sqrt(75_000))  # (1e4 + 4e4 + 9e4 + 16e4) / 4
    assert s.bias_mw == -50  # (100 - 200 + 300 - 400) / 4
    assert s.nmae == 0.25  # 1000 / 4000


def test_nmae_is_stable_when_some_actuals_are_near_zero() -> None:
    # Per-point MAPE here would be 50 000% on the calm hour; the ratio of totals stays sane.
    points = [point(1, 501), point(9999, 9499)]

    s = error_stats(points)

    assert s.nmae == pytest.approx(1000 / 10_000)


def test_nmae_is_none_when_there_was_no_wind_at_all() -> None:
    assert error_stats([point(0, 200)]).nmae is None


def test_error_stats_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        error_stats([])


@pytest.mark.parametrize(
    ("q", "expected"),
    [(0, 1), (10, 1.4), (25, 2), (50, 3), (90, 4.6), (100, 5)],
)
def test_percentile_interpolates_linearly(q: float, expected: float) -> None:
    # positions run 0..4, so P10 sits 0.4 of the way from 1 to 2
    assert percentile([5, 3, 1, 4, 2], q) == pytest.approx(expected)


def test_percentile_of_one_value_is_that_value() -> None:
    assert percentile([7], 90) == 7


@pytest.mark.parametrize(("values", "q"), [([], 50), ([1], -1), ([1], 101)])
def test_percentile_rejects_bad_input(values: list[float], q: float) -> None:
    with pytest.raises(ValueError):
        percentile(values, q)


def test_histogram_bins_are_round_and_half_open() -> None:
    bins = histogram([-250, -1, 0, 499, 500, 1200], bin_width=500)

    assert bins == [
        HistogramBin(-500, 0, 2),
        HistogramBin(0, 500, 2),
        HistogramBin(500, 1000, 1),
        HistogramBin(1000, 1500, 1),
    ]


def test_histogram_keeps_empty_bins_inside_the_range() -> None:
    bins = histogram([0, 1600], bin_width=500)

    assert [b.count for b in bins] == [1, 0, 0, 1]


def test_histogram_of_nothing_is_empty() -> None:
    assert histogram([], bin_width=500) == []


def test_histogram_rejects_non_positive_width() -> None:
    with pytest.raises(ValueError):
        histogram([1], bin_width=0)
