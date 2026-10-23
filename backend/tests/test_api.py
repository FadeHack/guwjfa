import math
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from reint_backend.api import get_dataset
from reint_backend.config import Settings
from reint_backend.dataset import Dataset
from reint_backend.main import app
from tests.factories import actual, at, forecast

# Four target hours, 00:00-04:00 on 1 Jan. Actual is 1000 MW on the hour and 9999 MW on the
# half-hour; the half-hours show up in the series but are never scored.
#
# Three runs:
#   C  31 Dec 07:30 (before the 09:20 day-ahead cutoff)  2000 MW for hours 0-3
#   A  31 Dec 18:00                                       1200 MW for hours 0-3
#   B  31 Dec 23:00                                        900 MW for hours 1-3
#
# At a 4 h horizon hours 0-2 use A and hour 3 uses B: errors +200, +200, +200, -100.
RUN_C, RUN_A, RUN_B = at(-16.5), at(-6), at(-1)


def fixture_dataset() -> Dataset:
    actuals = [actual(at(h / 2), 1000 if h % 2 == 0 else 9999) for h in range(8)]
    forecasts = [
        *(forecast(RUN_C, at(h), 2000) for h in range(4)),
        *(forecast(RUN_A, at(h), 1200) for h in range(4)),
        *(forecast(RUN_B, at(h), 900) for h in range(1, 4)),
    ]
    meta = {
        "ingested_at": "2026-10-23T14:49:47Z",
        "source": "https://elexon.test",
        "quality": {
            "actual_slots_expected": 8,
            "actual_slots_missing": [],
            "target_hours_without_forecast": [],
            "forecast_rows_dropped_negative_horizon": 5,
            "off_schedule_runs": ["2025-12-31T23:00:00Z"],
        },
    }
    return Dataset.from_records(actuals, forecasts, at(0), at(4), Settings(), meta)


@pytest.fixture
def client() -> Iterator[TestClient]:
    ds = fixture_dataset()
    app.dependency_overrides[get_dataset] = lambda: ds
    yield TestClient(app)
    app.dependency_overrides.clear()


def get(client: TestClient, url: str) -> Any:
    response = client.get(url)
    assert response.status_code == 200, response.text
    return response.json()


def errors(client: TestClient, url: str) -> list[str]:
    response = client.get(url)
    assert response.status_code == 422, response.text
    return [e["msg"] for e in response.json()["detail"]]


def test_meta_describes_the_loaded_data(client: TestClient) -> None:
    body = get(client, "/api/meta")

    assert body["available_start"] == "2026-01-01T00:00:00Z"
    assert body["available_end"] == "2026-01-01T04:00:00Z"
    assert body["actual_half_hours"] == 8
    assert body["forecast_runs"] == 3
    assert body["target_hours"] == 4
    assert body["day_ahead_cutoff_local"] == "09:20"
    assert body["timezone"] == "Europe/London"
    assert body["quality"]["forecast_rows_dropped_negative_horizon"] == 5
    assert body["quality"]["off_schedule_runs"] == ["2025-12-31T23:00:00Z"]


def test_series_returns_half_hourly_actuals_and_the_selected_forecasts(
    client: TestClient,
) -> None:
    body = get(client, "/api/series?horizon=4")

    assert body["window"] == {
        "start": "2026-01-01T00:00:00Z",
        "end": "2026-01-01T04:00:00Z",
        "mode": "horizon",
        "horizon_hours": 4,
    }
    assert [a["generation_mw"] for a in body["actual"]] == [1000, 9999] * 4
    assert [f["generation_mw"] for f in body["forecast"]] == [1200, 1200, 1200, 900]
    assert body["forecast"][3] == {
        "target_time": "2026-01-01T03:00:00Z",
        "publish_time": "2025-12-31T23:00:00Z",
        "horizon_hours": 4.0,
        "generation_mw": 900,
    }


def test_series_is_limited_to_the_window(client: TestClient) -> None:
    body = get(client, "/api/series?start=2026-01-01T01:00:00Z&end=2026-01-01T02:00:00Z")

    assert [a["time"] for a in body["actual"]] == ["2026-01-01T01:00:00Z", "2026-01-01T01:30:00Z"]
    assert [f["target_time"] for f in body["forecast"]] == ["2026-01-01T01:00:00Z"]


def test_series_day_ahead_has_no_single_horizon(client: TestClient) -> None:
    body = get(client, "/api/series?mode=day_ahead&horizon=12")

    assert body["window"]["horizon_hours"] is None
    assert {f["publish_time"] for f in body["forecast"]} == {"2025-12-31T07:30:00Z"}


@pytest.mark.parametrize(
    ("query", "mae", "bias", "rmse", "nmae"),
    [
        # errors +200, +200, +200, -100
        ("horizon=4", 175, 125, math.sqrt(32_500), 0.175),
        # hour 0 still uses A (B skips it); hours 1-3 use B: +200, -100, -100, -100
        ("horizon=0", 125, -25, math.sqrt(17_500), 0.125),
        # everything from run C: +1000 x 4
        ("mode=day_ahead", 1000, 1000, 1000, 1.0),
    ],
)
def test_metrics_hand_computed(
    client: TestClient, query: str, mae: float, bias: float, rmse: float, nmae: float
) -> None:
    stats = get(client, f"/api/metrics?{query}")["stats"]

    assert stats["count"] == 4
    assert stats["mae_mw"] == pytest.approx(mae)
    assert stats["bias_mw"] == pytest.approx(bias)
    assert stats["rmse_mw"] == pytest.approx(rmse)
    assert stats["nmae"] == pytest.approx(nmae)


def test_times_without_an_offset_are_read_as_utc(client: TestClient) -> None:
    naive = get(client, "/api/metrics?start=2026-01-01T01:00:00&end=2026-01-01T03:00:00")
    utc = get(client, "/api/metrics?start=2026-01-01T01:00:00Z&end=2026-01-01T03:00:00Z")

    assert naive == utc
    assert naive["stats"]["count"] == 2


def test_metrics_are_null_when_no_target_falls_in_the_window(client: TestClient) -> None:
    body = get(client, "/api/metrics?start=2026-01-01T00:30:00Z&end=2026-01-01T01:00:00Z")

    assert body["stats"] is None


def test_horizon_curve_covers_0_to_48_hours(client: TestClient) -> None:
    points = get(client, "/api/analysis/horizon")["points"]

    assert [p["horizon_hours"] for p in points] == list(range(49))
    assert points[0]["stats"]["mae_mw"] == pytest.approx(125)
    assert points[4]["stats"]["mae_mw"] == pytest.approx(175)
    # Run C is 16.5 h before hour 0, so at 17 h only hours 1-3 are covered.
    assert points[17]["stats"]["count"] == 3
    assert points[48]["stats"] is None


def test_horizon_curve_respects_the_window(client: TestClient) -> None:
    body = get(client, "/api/analysis/horizon?start=2026-01-01T03:00:00Z")

    assert body["start"] == "2026-01-01T03:00:00Z"
    assert body["points"][4]["stats"]["count"] == 1
    assert body["points"][4]["stats"]["bias_mw"] == -100


def test_horizon_curve_does_not_accept_selection_params(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    params = schema["paths"]["/api/analysis/horizon"]["get"]["parameters"]

    assert {p["name"] for p in params} == {"start", "end"}


def test_distribution_hand_computed(client: TestClient) -> None:
    body = get(client, "/api/analysis/distribution?horizon=4&bin_width=500")
    dist = body["distribution"]

    assert body["bin_width_mw"] == 500
    assert dist["count"] == 4
    # sorted errors -100, 200, 200, 200: positions 0..3
    assert dist["p10_mw"] == pytest.approx(-10)  # -100 + 0.3 * 300
    assert dist["p50_mw"] == pytest.approx(200)
    assert dist["p90_mw"] == pytest.approx(200)
    assert dist["bins"] == [
        {"lower_mw": -500, "upper_mw": 0, "count": 1},
        {"lower_mw": 0, "upper_mw": 500, "count": 3},
    ]


def test_breakdown_by_hour_and_level(client: TestClient) -> None:
    body = get(client, "/api/analysis/breakdown?horizon=4")

    by_hour = {h["hour"]: h["stats"] for h in body["by_hour"]}
    assert len(by_hour) == 24
    assert [by_hour[h]["mae_mw"] for h in range(4)] == [200, 200, 200, 100]
    assert by_hour[4] is None
    assert body["by_level"][0] == {
        "lower_mw": 0,
        "upper_mw": 5000,
        "stats": {
            "count": 4,
            "mae_mw": 175,
            "rmse_mw": pytest.approx(math.sqrt(32_500)),
            "bias_mw": 125,
            "nmae": 0.175,
        },
    }
    assert body["by_level"][-1]["upper_mw"] is None


@pytest.mark.parametrize(
    ("url", "message"),
    [
        ("/api/metrics?start=2025-12-31T00:00:00Z", "start is outside the available range"),
        ("/api/metrics?end=2026-01-02T00:00:00Z", "end is outside the available range"),
        ("/api/metrics?end=2026-01-01T00:00:00Z", "end is outside the available range"),
        (
            "/api/metrics?start=2026-01-01T02:00:00Z&end=2026-01-01T01:00:00Z",
            "start must be before end",
        ),
        # only start given, at or after the default end
        ("/api/series?start=2026-01-01T04:00:00Z", "start is outside the available range"),
        ("/api/metrics?horizon=49", "less than or equal to 48"),
        ("/api/metrics?horizon=-1", "greater than or equal to 0"),
        ("/api/metrics?mode=weekly", "'horizon' or 'day_ahead'"),
        ("/api/metrics?start=yesterday", "valid datetime"),
        ("/api/analysis/distribution?bin_width=10", "greater than or equal to 50"),
        ("/api/analysis/horizon?start=2025-01-01T00:00:00Z", "start is outside"),
    ],
)
def test_bad_input_gets_a_clear_422(client: TestClient, url: str, message: str) -> None:
    assert any(message in m for m in errors(client, url))


def test_out_of_range_message_states_the_available_range(client: TestClient) -> None:
    [msg] = errors(client, "/api/metrics?start=2025-12-31T00:00:00Z")

    assert "2026-01-01T00:00:00Z to 2026-01-01T04:00:00Z" in msg


def test_openapi_groups_endpoints_by_tag(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]

    assert paths["/api/series"]["get"]["tags"] == ["forecasts"]
    assert paths["/api/metrics"]["get"]["tags"] == ["accuracy"]
    assert paths["/api/meta"]["get"]["tags"] == ["meta"]
