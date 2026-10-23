from datetime import date

import httpx
import pytest
import respx

from reint_backend.elexon import ElexonClient, ElexonError
from tests.factories import actual_json, at, forecast_json

BASE = "https://elexon.test/api"


@pytest.fixture
def client() -> ElexonClient:
    return ElexonClient(BASE, http=httpx.Client(base_url=BASE), chunk_days=7, backoff_seconds=0)


@respx.mock
def test_actuals_are_requested_in_inclusive_date_chunks(client: ElexonClient) -> None:
    route = respx.get(f"{BASE}/datasets/FUELHH/stream").mock(
        return_value=httpx.Response(200, json=[actual_json(at(0))])
    )

    records = client.wind_actuals(date(2026, 1, 1), date(2026, 1, 10))

    sent = [dict(call.request.url.params) for call in route.calls]
    assert sent == [
        {"settlementDateFrom": "2026-01-01", "settlementDateTo": "2026-01-07", "fuelType": "WIND"},
        {"settlementDateFrom": "2026-01-08", "settlementDateTo": "2026-01-10", "fuelType": "WIND"},
    ]
    assert len(records) == 2
    assert records[0].generation == 1000


@respx.mock
def test_forecasts_are_requested_in_adjacent_publish_windows(client: ElexonClient) -> None:
    route = respx.get(f"{BASE}/datasets/WINDFOR/stream").mock(
        return_value=httpx.Response(200, json=[forecast_json(at(0), at(4))])
    )

    records = client.wind_forecasts(at(0), at(24 * 10))

    sent = [dict(call.request.url.params) for call in route.calls]
    assert sent == [
        {
            "publishDateTimeFrom": f"2026-01-{a}T00:00:00Z",
            "publishDateTimeTo": f"2026-01-{b}T00:00:00Z",
        }
        for a, b in [("01", "08"), ("08", "11")]
    ]
    assert records[0].horizon_hours == 4


@respx.mock
def test_retries_transient_failures(client: ElexonClient) -> None:
    respx.get(f"{BASE}/datasets/WINDFOR/stream").mock(
        side_effect=[
            httpx.Response(503),
            httpx.ConnectError("reset"),
            httpx.Response(200, json=[]),
        ]
    )

    assert client.wind_forecasts(at(0), at(1)) == []


@respx.mock
def test_gives_up_after_max_attempts(client: ElexonClient) -> None:
    route = respx.get(f"{BASE}/datasets/WINDFOR/stream").mock(return_value=httpx.Response(502))

    with pytest.raises(ElexonError, match="after 4 attempts"):
        client.wind_forecasts(at(0), at(1))
    assert route.call_count == 4


@respx.mock
def test_client_errors_are_not_retried(client: ElexonClient) -> None:
    route = respx.get(f"{BASE}/datasets/WINDFOR/stream").mock(return_value=httpx.Response(400))

    with pytest.raises(httpx.HTTPStatusError):
        client.wind_forecasts(at(0), at(1))
    assert route.call_count == 1


@respx.mock
def test_rejects_malformed_records(client: ElexonClient) -> None:
    bad = forecast_json(at(0), at(1)) | {"generation": -5}
    respx.get(f"{BASE}/datasets/WINDFOR/stream").mock(return_value=httpx.Response(200, json=[bad]))

    with pytest.raises(ValueError):
        client.wind_forecasts(at(0), at(1))
