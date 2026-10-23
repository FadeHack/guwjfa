from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from reint_backend.analysis import (
    breakdown_by_hour,
    breakdown_by_level,
    error_by_horizon,
    error_distribution,
)
from reint_backend.metrics import ErrorPoint
from reint_backend.selection import ForecastBook
from tests.factories import at, forecast

LONDON = ZoneInfo("Europe/London")


def point(target: datetime, actual_mw: int, forecast_mw: int) -> ErrorPoint:
    return ErrorPoint(target, target - timedelta(hours=4), actual_mw, forecast_mw)


def test_error_by_horizon_scores_each_horizon_separately() -> None:
    target = at(10)
    book = ForecastBook(
        [
            forecast(target - timedelta(hours=3), target, 1600),  # 3 h old, off by 600
            forecast(target - timedelta(hours=1), target, 1100),  # 1 h old, off by 100
        ]
    )

    curve = error_by_horizon(book, {target: 1000}, range(5))

    assert [h.horizon_hours for h in curve] == [0, 1, 2, 3, 4]
    assert [h.stats.mae_mw if h.stats else None for h in curve] == [100, 100, 600, 600, None]


def test_distribution_hand_computed() -> None:
    # errors -200, 0, 100, 300, 800
    points = [point(at(h), 1000, 1000 + e) for h, e in enumerate([300, -200, 800, 0, 100])]

    d = error_distribution(points, bin_width_mw=500)

    assert d.count == 5
    assert d.p10_mw == pytest.approx(-120)  # -200 + 0.4 * 200
    assert d.p50_mw == 100
    assert d.p90_mw == pytest.approx(600)  # 300 + 0.6 * 500
    assert [(b.lower_mw, b.count) for b in d.bins] == [(-500, 1), (0, 3), (500, 1)]


def test_distribution_rejects_empty_input() -> None:
    with pytest.raises(ValueError):
        error_distribution([], bin_width_mw=500)


def test_breakdown_by_hour_uses_uk_local_time() -> None:
    # 23:00 UTC on 30 Jun is midnight in London; 12:00 UTC in January is noon.
    summer = point(datetime(2026, 6, 30, 23, tzinfo=UTC), 1000, 1200)
    winter = point(datetime(2026, 1, 5, 12, tzinfo=UTC), 1000, 700)
    winter_too = point(datetime(2026, 1, 6, 12, tzinfo=UTC), 1000, 900)

    hours = breakdown_by_hour([summer, winter, winter_too], LONDON)

    assert len(hours) == 24
    by_hour = {h.hour: h.stats for h in hours}
    assert by_hour[0] is not None and by_hour[0].mae_mw == 200
    assert by_hour[12] is not None and by_hour[12].mae_mw == 200  # (300 + 100) / 2
    assert by_hour[23] is None


def test_breakdown_by_level_buckets_on_the_forecast() -> None:
    points = [
        point(at(0), 9000, 4999),  # forecast says < 5 GW, even though actual was 9 GW
        point(at(1), 5000, 5000),  # lower edge belongs to the bucket above
        point(at(2), 6000, 9000),
        point(at(3), 20000, 25000),
    ]

    levels = breakdown_by_level(points, edges_mw=[0, 5000, 10000])

    assert [(lv.lower_mw, lv.upper_mw) for lv in levels] == [
        (0, 5000),
        (5000, 10000),
        (10000, None),
    ]
    assert [lv.stats.count if lv.stats else 0 for lv in levels] == [1, 2, 1]
    assert levels[1].stats is not None and levels[1].stats.mae_mw == 1500  # (0 + 3000) / 2


def test_breakdown_by_level_reports_empty_buckets() -> None:
    levels = breakdown_by_level([point(at(0), 100, 100)], edges_mw=[0, 5000])

    assert levels[1].stats is None


@pytest.mark.parametrize("edges", [[], [0, 0, 5000], [5000, 0]])
def test_breakdown_by_level_rejects_bad_edges(edges: list[int]) -> None:
    with pytest.raises(ValueError):
        breakdown_by_level([], edges_mw=edges)
