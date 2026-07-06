"""API integration tests for trading bot CRUD endpoints."""

from app.bot_engine.orders import OrderRequest


def test_bots_require_auth(client):
    assert client.get("/api/bots").status_code == 401
    assert client.post("/api/bots", json={}).status_code == 401


def test_create_list_update_and_delete_bot(client, auth_headers):
    payload = {
        "name": "BTC Demo Grid Bot",
        "exchange": "bybit",
        "environment": "demo",
        "strategy_type": "grid",
        "category": "linear",
        "symbol": "BTCUSDT",
        "order_qty": 0.001,
        "grid_orders_count": 2,
        "grid_step_percent": 5,
        "is_active": True,
    }

    create = client.post("/api/bots", json=payload, headers=auth_headers)
    assert create.status_code == 201, create.text
    created_bot = create.json()
    assert created_bot["name"] == payload["name"]
    assert created_bot["environment"] == "demo"

    listed = client.get("/api/bots", headers=auth_headers)
    assert listed.status_code == 200
    assert any(bot["id"] == created_bot["id"] for bot in listed.json())

    fetched = client.get(
        f"/api/bots/{created_bot['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["symbol"] == "BTCUSDT"

    update = client.put(
        f"/api/bots/{created_bot['id']}",
        json={
            "name": "ETH Testnet Grid Bot",
            "environment": "testnet",
            "symbol": "ETHUSDT",
            "order_qty": 0.01,
            "grid_orders_count": 6,
            "grid_step_percent": 1.25,
            "is_active": False,
        },
        headers=auth_headers,
    )
    assert update.status_code == 200, update.text
    updated_bot = update.json()
    assert updated_bot["name"] == "ETH Testnet Grid Bot"
    assert updated_bot["environment"] == "testnet"
    assert updated_bot["is_active"] is False

    deleted = client.delete(
        f"/api/bots/{created_bot['id']}", headers=auth_headers)
    assert deleted.status_code == 204

    refetch = client.get(
        f"/api/bots/{created_bot['id']}", headers=auth_headers)
    assert refetch.status_code == 404


def test_start_sync_stop_and_list_bot_orders(client, auth_headers, monkeypatch):
    create = client.post(
        "/api/bots",
        json={
            "name": "BTC Runtime Bot",
            "exchange": "bybit",
            "environment": "demo",
            "strategy_type": "grid",
            "category": "linear",
            "symbol": "BTCUSDT",
            "order_qty": 0.001,
            "grid_orders_count": 2,
            "grid_step_percent": 5,
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    bot = create.json()

    def fake_get_bybit_session(_bot):
        return object()

    monkeypatch.setattr(
        "app.bot_engine.bot.get_bybit_session", fake_get_bybit_session)
    monkeypatch.setattr(
        "app.bot_engine.bot.get_open_positions", lambda *args, **kwargs: [])
    monkeypatch.setattr("app.bot_engine.bot.get_open_orders",
                        lambda *args, **kwargs: [])
    monkeypatch.setattr("app.bot_engine.bot.get_last_price",
                        lambda *args, **kwargs: 100.0)
    monkeypatch.setattr(
        "app.bot_engine.bot.place_order",
        lambda *args, **kwargs: {"result": {
            "orderId": f"oid-{kwargs['order'].order_role}", "orderStatus": "New"}},
    )
    monkeypatch.setattr(
        "app.bot_engine.bot.cancel_order",
        lambda *args, **kwargs: {"result": {
            "orderId": kwargs["order_id"], "orderStatus": "Cancelled"}},
    )
    monkeypatch.setattr(
        "app.bot_engine.bot.get_order_status",
        lambda *args, **kwargs: {"orderId": kwargs["order_id"],
                                 "orderStatus": "Filled", "price": "95.0"},
    )

    started = client.post(f"/api/bots/{bot['id']}/start", headers=auth_headers)
    assert started.status_code == 200, started.text
    started_body = started.json()
    assert started_body["action"] == "CREATE_GRID"
    assert started_body["bot"]["runtime_status"] == "running"
    assert len(started_body["orders"]) == 2
    assert started_body["orders"][0]["order_role"] == "grid_entry_1"

    orders = client.get(f"/api/bots/{bot['id']}/orders", headers=auth_headers)
    assert orders.status_code == 200
    assert len(orders.json()) == 2

    synced = client.post(f"/api/bots/{bot['id']}/sync", headers=auth_headers)
    assert synced.status_code == 200, synced.text
    assert all(order["status"] == "Filled" for order in synced.json())

    stopped = client.post(f"/api/bots/{bot['id']}/stop", headers=auth_headers)
    assert stopped.status_code == 200, stopped.text
    assert stopped.json()["runtime_status"] == "stopped"


def test_inactive_bot_cannot_start(client, auth_headers):
    create = client.post(
        "/api/bots",
        json={
            "name": "Inactive Bot",
            "exchange": "bybit",
            "environment": "demo",
            "strategy_type": "grid",
            "category": "linear",
            "symbol": "BTCUSDT",
            "order_qty": 0.001,
            "grid_orders_count": 2,
            "grid_step_percent": 5,
            "is_active": False,
        },
        headers=auth_headers,
    )
    bot = create.json()

    start = client.post(f"/api/bots/{bot['id']}/start", headers=auth_headers)
    assert start.status_code == 422
