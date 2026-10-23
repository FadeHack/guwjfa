import sqlite3
from contextlib import closing
from pathlib import Path

import httpx
import respx

from reint_backend import store
from reint_backend.config import Settings
from reint_backend.elexon import ElexonClient
from reint_backend.ingest import run
from tests.factories import actual, actual_json, at, forecast, forecast_json

BASE = "https://elexon.test/api"


def rows(db: Path, sql: str) -> list[tuple[object, ...]]:
    with closing(sqlite3.connect(db)) as conn:
        return conn.execute(sql).fetchall()


def test_replace_all_rebuilds_instead_of_appending(tmp_path: Path) -> None:
    db = tmp_path / "wind.sqlite"
    store.replace_all(db, [actual(at(0))], [forecast(at(-1), at(0))], {"run": 1})
    store.replace_all(db, [actual(at(1), 2000)], [], {"run": 2})

    assert rows(db, "SELECT * FROM actuals") == [("2026-01-01T01:00:00Z", "2026-01-01", 3, 2000)]
    assert rows(db, "SELECT COUNT(*) FROM forecasts") == [(0,)]
    assert store.read_meta(db) == {"run": 2}


@respx.mock
def test_ingest_writes_clean_dataset_and_report(tmp_path: Path) -> None:
    respx.get(f"{BASE}/datasets/FUELHH/stream").mock(
        return_value=httpx.Response(200, json=[actual_json(at(0), 900), actual_json(at(0.5), 950)])
    )
    respx.get(f"{BASE}/datasets/WINDFOR/stream").mock(
        return_value=httpx.Response(
            200, json=[forecast_json(at(-2), at(0), 1000), forecast_json(at(-2), at(-3), 1)]
        )
    )
    cfg = Settings(target_start=at(0), target_end=at(1), elexon_base_url=BASE)
    db = tmp_path / "wind.sqlite"
    client = ElexonClient(BASE, http=httpx.Client(base_url=BASE), backoff_seconds=0)

    report = run(cfg, client, db)

    assert report.is_clean
    assert rows(db, "SELECT start_time, generation_mw FROM actuals ORDER BY 1") == [
        ("2026-01-01T00:00:00Z", 900),
        ("2026-01-01T00:30:00Z", 950),
    ]
    assert rows(db, "SELECT * FROM forecasts") == [
        ("2025-12-31T22:00:00Z", "2026-01-01T00:00:00Z", 1000)
    ]
    meta = store.read_meta(db)
    assert meta["target_start"] == "2026-01-01T00:00:00Z"
    assert meta["quality"]["forecast_rows_dropped_negative_horizon"] == 1
