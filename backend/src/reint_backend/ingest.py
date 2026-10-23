"""Download wind actuals and forecasts from Elexon and rebuild the local dataset.

    uv run python -m reint_backend.ingest [--db PATH]

The API only ever reads the resulting SQLite file, so the deployed app never depends on
Elexon being up.
"""

import argparse
import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from reint_backend import quality, store
from reint_backend.config import Settings, settings
from reint_backend.elexon import ElexonClient
from reint_backend.models import to_utc_iso

log = logging.getLogger("reint_backend.ingest")


def run(cfg: Settings, client: ElexonClient, db_path: Path) -> quality.QualityReport:
    start, end = cfg.target_start, cfg.target_end
    # Settlement dates are UK days; in January they coincide with UTC days.
    actuals = client.wind_actuals(start.date(), (end - timedelta(seconds=1)).date())
    forecasts = client.wind_forecasts(start - timedelta(hours=cfg.forecast_lookback_hours), end)
    log.info("fetched %d actual rows, %d forecast rows", len(actuals), len(forecasts))

    clean_actuals, clean_forecasts, report = quality.clean(actuals, forecasts, start, end)
    store.replace_all(
        db_path,
        clean_actuals,
        clean_forecasts,
        meta={
            "ingested_at": to_utc_iso(datetime.now(UTC)),
            "source": cfg.elexon_base_url,
            "target_start": to_utc_iso(start),
            "target_end": to_utc_iso(end),
            "quality": report.as_dict(),
        },
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--db", type=Path, default=settings.db_path)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    with ElexonClient(settings.elexon_base_url) as client:
        report = run(settings, client, args.db)

    print(json.dumps(report.as_dict(), indent=2))
    print(f"wrote {args.db} ({'clean' if report.is_clean else 'has gaps, see report'})")


if __name__ == "__main__":
    main()
