"""API integration tests using FastAPI TestClient + SQLite."""
import pytest


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert "name" in body
    assert body["docs"] == "/docs"


def test_list_strategies(client):
    response = client.get("/api/strategies")
    assert response.status_code == 200
    body = response.json()
    ids = [s["id"] for s in body]
    assert "ma_crossover" in ids
    assert "rsi" in ids


def test_start_and_fetch_backtest_ma(client):
    payload = {
        "symbol": "BTC/USDT",
        "initial_balance": 10000,
        "strategy": "ma_crossover",
        "ma_params": {"fast_window": 10, "slow_window": 30},
        "risk": {
            "position_size_percent": 20,
            "stop_loss_percent": 5,
            "max_drawdown_percent": 25,
        },
    }
    create = client.post("/api/backtests/start", json=payload)
    assert create.status_code == 201, create.text
    run = create.json()
    assert run["id"] > 0
    assert run["strategy_name"] == "Moving Average Crossover"
    assert "equity_points" in run and len(run["equity_points"]) > 0

    fetch = client.get(f"/api/backtests/{run['id']}")
    assert fetch.status_code == 200
    assert fetch.json()["id"] == run["id"]


def test_start_backtest_rsi(client):
    payload = {
        "symbol": "ETH/USDT",
        "initial_balance": 5000,
        "strategy": "rsi",
        "rsi_params": {"rsi_period": 14, "oversold": 30, "overbought": 70},
        "risk": {
            "position_size_percent": 25,
            "stop_loss_percent": 6,
            "max_drawdown_percent": 20,
        },
    }
    response = client.post("/api/backtests/start", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["strategy_name"] == "RSI Mean Reversion"


def test_list_backtests(client):
    response = client.get("/api/backtests")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)


def test_fetch_unknown_backtest_returns_404(client):
    response = client.get("/api/backtests/999999")
    assert response.status_code == 404


def test_validation_error_for_bad_params(client):
    payload = {
        "symbol": "BTC/USDT",
        "initial_balance": -1,  # invalid
        "strategy": "ma_crossover",
    }
    response = client.post("/api/backtests/start", json=payload)
    assert response.status_code in (400, 422)


def test_delete_backtest(client):
    payload = {
        "symbol": "BTC/USDT",
        "initial_balance": 10000,
        "strategy": "ma_crossover",
    }
    create = client.post("/api/backtests/start", json=payload)
    assert create.status_code == 201
    run_id = create.json()["id"]

    delete = client.delete(f"/api/backtests/{run_id}")
    assert delete.status_code == 204

    fetch = client.get(f"/api/backtests/{run_id}")
    assert fetch.status_code == 404
