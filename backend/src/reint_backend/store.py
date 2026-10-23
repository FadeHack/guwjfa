import json
import sqlite3
from collections.abc import Iterable
from contextlib import closing
from pathlib import Path
from typing import Any

from reint_backend.models import ActualRecord, ForecastRecord, to_utc_iso

# Times are fixed-width UTC strings (see `to_utc_iso`) so range filters and ORDER BY work
# on plain text comparison.
SCHEMA = """
CREATE TABLE IF NOT EXISTS actuals (
    start_time        TEXT PRIMARY KEY,
    settlement_date   TEXT    NOT NULL,
    settlement_period INTEGER NOT NULL,
    generation_mw     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS forecasts (
    publish_time  TEXT    NOT NULL,
    start_time    TEXT    NOT NULL,
    generation_mw INTEGER NOT NULL,
    PRIMARY KEY (publish_time, start_time)
);
CREATE INDEX IF NOT EXISTS forecasts_by_target ON forecasts (start_time, publish_time);
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn


def replace_all(
    path: Path,
    actuals: Iterable[ActualRecord],
    forecasts: Iterable[ForecastRecord],
    meta: dict[str, Any],
) -> None:
    """Rebuild the dataset in one transaction, so a failed ingest never leaves a half-written
    file behind for the API to serve."""
    with closing(connect(path)) as conn, conn:
        conn.execute("DELETE FROM actuals")
        conn.execute("DELETE FROM forecasts")
        conn.execute("DELETE FROM meta")
        conn.executemany(
            "INSERT OR REPLACE INTO actuals VALUES (?, ?, ?, ?)",
            (
                (
                    to_utc_iso(a.start_time),
                    a.settlement_date.isoformat(),
                    a.settlement_period,
                    a.generation,
                )
                for a in actuals
            ),
        )
        conn.executemany(
            "INSERT OR REPLACE INTO forecasts VALUES (?, ?, ?)",
            (
                (to_utc_iso(f.publish_time), to_utc_iso(f.start_time), f.generation)
                for f in forecasts
            ),
        )
        conn.executemany(
            "INSERT INTO meta VALUES (?, ?)",
            ((key, json.dumps(value)) for key, value in meta.items()),
        )
    with closing(sqlite3.connect(path)) as conn:
        conn.execute("VACUUM")


def read_meta(path: Path) -> dict[str, Any]:
    with closing(connect(path)) as conn:
        return {
            key: json.loads(value) for key, value in conn.execute("SELECT key, value FROM meta")
        }
