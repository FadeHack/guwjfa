from datetime import UTC, date, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class ActualRecord(BaseModel):
    """Half-hourly wind outturn from FUELHH. `generation` is the period average in MW."""

    model_config = ConfigDict(frozen=True)

    start_time: AwareDatetime = Field(alias="startTime")
    settlement_date: date = Field(alias="settlementDate")
    settlement_period: int = Field(alias="settlementPeriod", ge=1, le=50)
    generation: int = Field(ge=0)


class ForecastRecord(BaseModel):
    """One hourly point of a WINDFOR forecast run, in MW."""

    model_config = ConfigDict(frozen=True)

    publish_time: AwareDatetime = Field(alias="publishTime")
    start_time: AwareDatetime = Field(alias="startTime")
    generation: int = Field(ge=0)

    @property
    def horizon_hours(self) -> float:
        return (self.start_time - self.publish_time).total_seconds() / 3600


def to_utc_iso(value: datetime) -> str:
    """Fixed-width UTC string, so lexical order in SQLite matches time order."""
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
