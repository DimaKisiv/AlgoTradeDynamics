"""Integration tests for immutable compliance audit trail."""
import uuid

from sqlalchemy import text

from app.db.session import SessionLocal
from app.models.audit_event import AuditEvent


def _login(client):
    email = f"audit_{uuid.uuid4().hex[:10]}@test.dev"
    password = "secret123"
    assert client.post("/api/auth/register", json={"email": email, "password": password}).status_code == 201
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}, email


def _create_bot(client, headers):
    response = client.post("/api/bots", headers=headers, json={
        "name": "Audit BTC Bot", "exchange": "bybit", "environment": "demo", "strategy_type": "grid",
        "category": "linear", "symbol": "BTCUSDT", "order_qty": 0.001,
        "grid_orders_count": 2, "grid_step_percent": 5, "is_active": True,
    })
    assert response.status_code == 201, response.text
    return response.json()


def test_audit_records_security_and_bot_configuration(client):
    headers, email = _login(client)
    bot = _create_bot(client, headers)

    response = client.get("/api/audit/events?page_size=200", headers=headers)
    assert response.status_code == 200, response.text
    events = response.json()["items"]
    types = {item["event_type"] for item in events}
    assert "USER_REGISTERED" in types
    assert "USER_LOGIN" in types
    assert "BOT_CREATED" in types
    bot_created = next(item for item in events if item["event_type"] == "BOT_CREATED")
    assert bot_created["bot_id"] == bot["id"]
    assert bot_created["actor_label"] == email
    assert bot_created["config_hash"]
    assert bot_created["retention_until"]
    assert bot_created["event_hash"]


def test_clear_operational_history_does_not_clear_audit(client):
    headers, _ = _login(client)
    bot = _create_bot(client, headers)

    before = client.get(f"/api/audit/events?bot_id={bot['id']}&page_size=200", headers=headers).json()
    assert any(item["event_type"] == "BOT_CREATED" for item in before["items"])

    cleared = client.post(f"/api/bots/{bot['id']}/clear-history", headers=headers)
    assert cleared.status_code == 200, cleared.text

    after = client.get(f"/api/audit/events?bot_id={bot['id']}&page_size=200", headers=headers).json()
    assert any(item["event_type"] == "BOT_CREATED" for item in after["items"])
    assert any(item["event_type"] == "BOT_OPERATIONAL_HISTORY_CLEARED" for item in after["items"])


def test_audit_integrity_detects_raw_tampering(client):
    headers, _ = _login(client)
    _create_bot(client, headers)
    ok = client.get("/api/audit/integrity", headers=headers)
    assert ok.status_code == 200
    assert ok.json()["valid"] is True

    # Deliberately bypass the ORM append-only guard to simulate out-of-band DB tampering.
    db = SessionLocal()
    try:
        user_event = db.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
        assert user_event is not None
        db.execute(text("UPDATE audit_events SET message='tampered' WHERE id=:id"), {"id": user_event.id})
        db.commit()
    finally:
        db.close()

    broken = client.get("/api/audit/integrity", headers=headers)
    assert broken.status_code == 200
    assert broken.json()["valid"] is False
    assert broken.json()["first_invalid_event_id"] is not None


def test_audit_export_csv_and_json(client):
    headers, _ = _login(client)
    _create_bot(client, headers)
    csv_response = client.get("/api/audit/export?format=csv", headers=headers)
    assert csv_response.status_code == 200
    assert "text/csv" in csv_response.headers["content-type"]
    assert "event_hash" in csv_response.text

    json_response = client.get("/api/audit/export?format=json", headers=headers)
    assert json_response.status_code == 200
    assert isinstance(json_response.json(), list)
    assert json_response.json()


def test_backtest_runtime_events_are_not_mirrored_to_regulatory_ledger(client):
    headers, _ = _login(client)
    # Reuse a real bot to get the current user id, then create a hidden backtest bot directly.
    live_bot = _create_bot(client, headers)
    db = SessionLocal()
    try:
        from app.bot_engine.events import log_bot_event
        from app.models.trading_bot import TradingBot
        user_id = db.query(AuditEvent).filter(AuditEvent.bot_id == live_bot["id"]).first().user_id
        backtest_bot = TradingBot(
            user_id=user_id, name="Hidden Backtest Bot", exchange="bybit", environment="demo",
            strategy_type="grid", category="linear", symbol="BTCUSDT", order_qty=0.001,
            grid_orders_count=2, grid_step_percent=5, is_active=True, is_backtest=True,
            settings={}, runtime_status="running",
        )
        db.add(backtest_bot); db.flush()
        log_bot_event(db, backtest_bot, "grid_entry_created", "Simulation event", {"order_link_id": "backtest-order"})
        db.commit()
        mirrored = db.query(AuditEvent).filter(AuditEvent.bot_id == backtest_bot.id).count()
        assert mirrored == 0
    finally:
        db.close()
