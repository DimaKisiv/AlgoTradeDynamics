"""Core API smoke tests."""
from app.api import bybit as bybit_api


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_bybit_test_endpoint(client, monkeypatch):
    monkeypatch.setattr(
        bybit_api, "test_bybit_connection",
        lambda: {"status": "ok", "message": "Bybit API connection successful", "demo": True},
    )
    response = client.get("/api/bybit/test")
    assert response.status_code == 200


def test_backtests_require_auth(client):
    assert client.get("/api/backtests").status_code == 401
    assert client.post("/api/backtests", json={}).status_code == 401


def test_unknown_backtest_returns_404(client, auth_headers):
    assert client.get("/api/backtests/999999", headers=auth_headers).status_code == 404
