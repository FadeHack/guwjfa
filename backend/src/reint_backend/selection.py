"""Which forecast counts for each target time.

Both modes answer the same question: of all the runs that predicted this hour, which was the
newest one a trader could actually have seen? They differ only in where the "could have seen"
line is drawn.
"""

from bisect import bisect_right
from collections import defaultdict
from collections.abc import Callable, Iterable
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from reint_backend.models import ForecastRecord


class ForecastBook:
    """Every forecast point, indexed by target time and ordered by publish time."""

    def __init__(self, forecasts: Iterable[ForecastRecord]) -> None:
        by_target: defaultdict[datetime, list[ForecastRecord]] = defaultdict(list)
        for f in forecasts:
            by_target[f.start_time].append(f)
        self._by_target = {
            t: sorted(runs, key=lambda f: f.publish_time) for t, runs in sorted(by_target.items())
        }

    @property
    def targets(self) -> list[datetime]:
        return list(self._by_target)

    def latest_at(self, target: datetime, cutoff: datetime) -> ForecastRecord | None:
        """The newest forecast for `target` published at or before `cutoff`."""
        runs = self._by_target.get(target)
        if not runs:
            return None
        i = bisect_right(runs, cutoff, key=lambda f: f.publish_time)
        return runs[i - 1] if i else None

    def by_horizon(self, horizon: timedelta) -> dict[datetime, ForecastRecord]:
        """Horizon mode: for each target T, the latest forecast with publishTime <= T - horizon.

        Targets with no run old enough are left out rather than filled with a fresher one.
        """
        return self._select(lambda target: target - horizon)

    def day_ahead(self, cutoff: time, tz: ZoneInfo) -> dict[datetime, ForecastRecord]:
        """Day-ahead mode: for each target, the latest forecast published by the purchase
        deadline for its delivery day (see `decision_time`)."""
        return self._select(lambda target: decision_time(target, cutoff, tz))

    def _select(self, cutoff_for: Callable[[datetime], datetime]) -> dict[datetime, ForecastRecord]:
        selected = {}
        for target in self._by_target:
            f = self.latest_at(target, cutoff_for(target))
            if f is not None:
                selected[target] = f
        return selected


def decision_time(target: datetime, cutoff: time, tz: ZoneInfo) -> datetime:
    """The day-ahead purchase deadline for the hour starting at `target`.

    The delivery day is the local calendar day the hour falls in, and the deadline is `cutoff`
    local time on the day before. Working in local time keeps it right across clock changes:
    09:20 UK is 09:20 UTC in winter and 08:20 UTC in summer.
    """
    delivery_day = target.astimezone(tz).date()
    return datetime.combine(delivery_day - timedelta(days=1), cutoff, tzinfo=tz)
