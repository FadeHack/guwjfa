"""API request and response models. All times are UTC (ISO 8601 with a trailing Z)."""

from datetime import UTC, datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from reint_backend.dataset import Mode

MAX_HORIZON_HOURS = 48


class WindowQuery(BaseModel):
    """Which target times to look at."""

    start: datetime | None = Field(
        None,
        description="Start of the target window, inclusive. UTC; a time without an offset is "
        "read as UTC. Defaults to the start of the data.",
    )
    end: datetime | None = Field(
        None, description="End of the target window, exclusive. Defaults to the end of the data."
    )

    @field_validator("start", "end")
    @classmethod
    def assume_utc(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value

    @model_validator(mode="after")
    def start_before_end(self) -> Self:
        if self.start and self.end and self.start >= self.end:
            raise ValueError("start must be before end")
        return self


class SelectionQuery(WindowQuery):
    """A target window plus the rule for which forecast counts for each target."""

    mode: Mode = Field(
        Mode.HORIZON,
        description="`horizon`: latest forecast published at least `horizon` hours before each "
        "target. `day_ahead`: latest forecast published by the purchase deadline on the day "
        "before delivery (09:20 UK).",
    )
    horizon: int = Field(
        4,
        ge=0,
        le=MAX_HORIZON_HOURS,
        description="Forecast horizon in hours. Used only in `horizon` mode.",
    )


class Window(BaseModel):
    start: datetime
    end: datetime
    mode: Mode
    horizon_hours: int | None = Field(description="Null in `day_ahead` mode.")


class Stats(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    count: int = Field(description="Number of target hours scored.")
    mae_mw: float = Field(description="Mean absolute error.")
    rmse_mw: float = Field(description="Root mean squared error.")
    bias_mw: float = Field(
        description="Mean of forecast minus actual. Positive: forecasts ran high."
    )
    nmae: float | None = Field(
        description="Total absolute error over total actual output (0.15 = 15%). Null if "
        "actual output was zero throughout."
    )


class ActualPoint(BaseModel):
    time: datetime = Field(description="Start of the half-hour settlement period.")
    generation_mw: int


class ForecastPoint(BaseModel):
    target_time: datetime
    publish_time: datetime
    horizon_hours: float
    generation_mw: int


class SeriesResponse(BaseModel):
    window: Window
    actual: list[ActualPoint] = Field(description="Half-hourly outturn.")
    forecast: list[ForecastPoint] = Field(
        description="Hourly; the forecast that counts for each target under the chosen mode."
    )


class MetricsResponse(BaseModel):
    window: Window
    stats: Stats | None = Field(description="Null when no target in the window can be scored.")


class HorizonPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    horizon_hours: int
    stats: Stats | None


class HorizonResponse(BaseModel):
    start: datetime
    end: datetime
    points: list[HorizonPoint] = Field(
        description="One per hour from 0 to 48. Beyond ~43 h the overnight hours have no "
        "forecast that old, so `count` drops and the sample leans towards daytime."
    )


class Bin(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lower_mw: float = Field(description="Inclusive.")
    upper_mw: float = Field(description="Exclusive.")
    count: int


class Distribution(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    count: int
    bins: list[Bin]
    p10_mw: float
    p50_mw: float
    p90_mw: float = Field(
        description="Actual output was at or above forecast minus this 90% of the time."
    )


class DistributionResponse(BaseModel):
    window: Window
    bin_width_mw: int
    distribution: Distribution | None


class HourBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hour: int = Field(description="Hour of day in UK local time, 0-23.")
    stats: Stats | None


class LevelBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lower_mw: int = Field(description="Forecast output, inclusive.")
    upper_mw: int | None = Field(description="Exclusive; null for the top bucket.")
    stats: Stats | None


class BreakdownResponse(BaseModel):
    window: Window
    by_hour: list[HourBreakdown]
    by_level: list[LevelBreakdown]


class DataQuality(BaseModel):
    actual_slots_expected: int
    actual_slots_missing: int
    target_hours_without_forecast: int
    forecast_rows_dropped_negative_horizon: int
    off_schedule_runs: list[datetime]


class MetaResponse(BaseModel):
    available_start: datetime
    available_end: datetime = Field(description="Exclusive.")
    ingested_at: datetime | None
    source: str | None
    actual_half_hours: int
    forecast_runs: int = Field(description="Forecast runs with at least one usable point.")
    target_hours: int = Field(description="Target hours with at least one forecast.")
    max_horizon_hours: int
    day_ahead_cutoff_local: str = Field(description="HH:MM on the day before delivery.")
    timezone: str = Field(description="Time zone the UI should display times in.")
    quality: DataQuality | None
