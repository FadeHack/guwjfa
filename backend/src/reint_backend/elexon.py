import logging
import time
from collections.abc import Iterator
from datetime import date, datetime, timedelta

import httpx
from pydantic import TypeAdapter

from reint_backend.models import ActualRecord, ForecastRecord, to_utc_iso

log = logging.getLogger(__name__)

_actuals = TypeAdapter(list[ActualRecord])
_forecasts = TypeAdapter(list[ForecastRecord])

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class ElexonError(RuntimeError):
    pass


def _date_chunks(start: date, end: date, days: int) -> Iterator[tuple[date, date]]:
    """Inclusive [from, to] pairs, because FUELHH settlement-date filters are inclusive."""
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=days - 1), end)
        yield cursor, chunk_end
        cursor = chunk_end + timedelta(days=1)


def _time_chunks(start: datetime, end: datetime, days: int) -> Iterator[tuple[datetime, datetime]]:
    """Adjacent windows sharing a boundary. A run published exactly on it can come back
    twice; the store's primary key absorbs the duplicate."""
    cursor = start
    while cursor < end:
        chunk_end = min(cursor + timedelta(days=days), end)
        yield cursor, chunk_end
        cursor = chunk_end


class ElexonClient:
    """Fetches the two BMRS datasets this app uses. Both `stream` endpoints return a bare
    JSON array and accept the whole of January in one call, but chunking keeps a failed
    request cheap to retry and avoids depending on an undocumented size limit."""

    def __init__(
        self,
        base_url: str,
        *,
        http: httpx.Client | None = None,
        chunk_days: int = 7,
        max_attempts: int = 4,
        backoff_seconds: float = 1.0,
    ) -> None:
        self._http = http or httpx.Client(base_url=base_url, timeout=30.0)
        self._chunk_days = chunk_days
        self._max_attempts = max_attempts
        self._backoff = backoff_seconds

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "ElexonClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def wind_actuals(self, first_day: date, last_day: date) -> list[ActualRecord]:
        records: list[ActualRecord] = []
        for chunk_from, chunk_to in _date_chunks(first_day, last_day, self._chunk_days):
            payload = self._get(
                "/datasets/FUELHH/stream",
                {
                    "settlementDateFrom": chunk_from.isoformat(),
                    "settlementDateTo": chunk_to.isoformat(),
                    "fuelType": "WIND",
                },
            )
            records.extend(_actuals.validate_python(payload))
        return records

    def wind_forecasts(
        self, published_from: datetime, published_to: datetime
    ) -> list[ForecastRecord]:
        records: list[ForecastRecord] = []
        for chunk_from, chunk_to in _time_chunks(published_from, published_to, self._chunk_days):
            payload = self._get(
                "/datasets/WINDFOR/stream",
                {
                    "publishDateTimeFrom": to_utc_iso(chunk_from),
                    "publishDateTimeTo": to_utc_iso(chunk_to),
                },
            )
            records.extend(_forecasts.validate_python(payload))
        return records

    def _get(self, path: str, params: dict[str, str]) -> object:
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._http.get(path, params=params)
            except httpx.TransportError as exc:
                reason = f"{type(exc).__name__}: {exc}"
            else:
                if response.status_code not in RETRYABLE_STATUS:
                    response.raise_for_status()
                    return response.json()
                reason = f"HTTP {response.status_code}"

            if attempt == self._max_attempts:
                raise ElexonError(f"{path} failed after {attempt} attempts ({reason})")
            delay = self._backoff * 2 ** (attempt - 1)
            log.warning("%s %s, retrying in %.1fs", path, reason, delay)
            time.sleep(delay)
        raise AssertionError("unreachable")
