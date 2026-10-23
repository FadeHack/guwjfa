from datetime import UTC, datetime, timedelta
from typing import Any

from reint_backend.models import ActualRecord, ForecastRecord, to_utc_iso

T0 = datetime(2026, 1, 1, tzinfo=UTC)


def at(hours: float) -> datetime:
    return T0 + timedelta(hours=hours)


def actual_json(start: datetime, generation: int = 1000) -> dict[str, Any]:
    period = (start.hour * 60 + start.minute) // 30 + 1
    return {
        "dataset": "FUELHH",
        "publishTime": to_utc_iso(start + timedelta(minutes=30)),
        "startTime": to_utc_iso(start),
        "settlementDate": start.date().isoformat(),
        "settlementPeriod": period,
        "fuelType": "WIND",
        "generation": generation,
    }


def forecast_json(publish: datetime, start: datetime, generation: int = 1000) -> dict[str, Any]:
    return {
        "dataset": "WINDFOR",
        "publishTime": to_utc_iso(publish),
        "startTime": to_utc_iso(start),
        "generation": generation,
    }


def actual(start: datetime, generation: int = 1000) -> ActualRecord:
    return ActualRecord.model_validate(actual_json(start, generation))


def forecast(publish: datetime, start: datetime, generation: int = 1000) -> ForecastRecord:
    return ForecastRecord.model_validate(forecast_json(publish, start, generation))
