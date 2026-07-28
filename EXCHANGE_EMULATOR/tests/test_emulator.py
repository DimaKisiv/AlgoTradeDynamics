from __future__ import annotations

import os
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DB_PATH = Path("/tmp/algotrade_emulator_pytest.db")
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["EMULATOR_DATABASE_URL"] = f"sqlite:///{DB_PATH}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_manual_matching_scenario_and_replay():
    with TestClient(app) as client:
        account = client.get("/api/admin/accounts").json()[0]
        headers = {"X-API-Key": account["api_key"]}

        created = client.post(
            "/v5/order/create",
            headers=headers,
            json={
                "category": "linear",
                "symbol": "ETHUSDT",
                "side": "Buy",
                "orderType": "Limit",
                "qty": "0.01",
                "price": "3400",
                "orderLinkId": "pytest-entry-1",
            },
        ).json()
        assert created["retCode"] == 0

        client.post("/api/admin/markets/ETHUSDT/price", json={"price": 3300}).raise_for_status()
        positions = client.get(
            "/v5/position/list",
            headers=headers,
            params={"category": "linear", "symbol": "ETHUSDT"},
        ).json()["result"]["list"]
        assert positions[0]["size"] == "0.01"

        scenario = client.post(
            "/api/admin/scenarios",
            json={
                "name": "pytest scenario",
                "symbol": "ETHUSDT",
                "steps": [
                    {"price": 3200, "duration_seconds": 0},
                    {"price": 3500, "duration_seconds": 0},
                ],
            },
        ).json()
        client.post(f"/api/admin/scenarios/{scenario['id']}/start").raise_for_status()
        time.sleep(0.5)
        dashboard = client.get(
            f"/api/admin/dashboard?account_id={account['id']}&symbol=ETHUSDT"
        ).json()
        assert dashboard["market"]["status"] == "completed"

        csv_content = (
            "date,open,high,low,close,volume\n"
            "2024-01-01,3000,3100,2900,3050,10\n"
            "2024-01-02,3050,3200,3000,3150,12\n"
        )
        imported = client.post(
            "/api/admin/historical/import-csv?symbol=ETHUSDT&interval=D",
            files={"file": ("history.csv", csv_content, "text/csv")},
        ).json()
        assert imported["inserted"] == 2

        datasets = client.get("/api/admin/historical/datasets").json()
        dataset = next(item for item in datasets if item["symbol"] == "ETHUSDT" and item["interval"] == "D")
        replay = client.post(
            "/api/admin/markets/ETHUSDT/replay/start",
            json={
                "interval": "D",
                "start_time": dataset["from_time"],
                "end_time": dataset["to_time"],
                "speed": 100,
                "path_mode": "ohlc",
            },
        ).json()
        assert replay["total"] == 2
        time.sleep(0.5)
        dashboard = client.get(
            f"/api/admin/dashboard?account_id={account['id']}&symbol=ETHUSDT"
        ).json()
        assert dashboard["market"]["status"] == "completed"
