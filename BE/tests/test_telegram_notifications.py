"""Telegram notification account-linking and outbox tests."""
from urllib.parse import parse_qs, urlparse

from app.bot_engine.events import log_bot_event
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.telegram_notification import TelegramNotificationDelivery
from app.models.trading_bot import TradingBot
from app.services.telegram_notifications import link_from_start_message


def _configure_telegram(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "telegram_bot_token", "123456:test-token")
    monkeypatch.setattr(settings, "telegram_bot_username", "AlgoTradeDynamicsTestBot")


def _connect(client, auth_headers, monkeypatch, *, chat_id=123456789, telegram_user_id=987654321):
    _configure_telegram(monkeypatch)
    response = client.post("/api/notifications/telegram/connect", headers=auth_headers)
    assert response.status_code == 200, response.text
    url = response.json()["connect_url"]
    token = parse_qs(urlparse(url).query)["start"][0]

    db = SessionLocal()
    try:
        ok, reply = link_from_start_message(db, {
            "chat": {"id": chat_id, "type": "private"},
            "from": {"id": telegram_user_id, "username": "telegram_test_user"},
            "text": f"/start {token}",
        })
    finally:
        db.close()
    assert ok is True
    assert "підключено" in reply
    return token


def test_telegram_status_requires_auth(client):
    assert client.get("/api/notifications/telegram").status_code == 401


def test_telegram_connect_preferences_test_and_disconnect(client, auth_headers, monkeypatch):
    _connect(client, auth_headers, monkeypatch)

    status = client.get("/api/notifications/telegram", headers=auth_headers)
    assert status.status_code == 200
    body = status.json()
    assert body["configured"] is True
    assert body["connected"] is True
    assert body["username"] == "telegram_test_user"
    assert body["notify_trades"] is True

    updated = client.patch(
        "/api/notifications/telegram",
        json={"notify_trades": False, "notify_risk": False},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["notify_trades"] is False
    assert updated.json()["notify_risk"] is False

    sent = {}
    monkeypatch.setattr(
        "app.api.notifications.send_message_sync",
        lambda chat_id, text: sent.update({"chat_id": chat_id, "text": text}),
    )
    test = client.post("/api/notifications/telegram/test", headers=auth_headers)
    assert test.status_code == 200
    assert sent["chat_id"] == 123456789
    assert "AlgoTradeDynamics" in sent["text"]

    disconnected = client.delete("/api/notifications/telegram", headers=auth_headers)
    assert disconnected.status_code == 204
    after = client.get("/api/notifications/telegram", headers=auth_headers).json()
    assert after["connected"] is False


def test_telegram_start_link_is_single_use(client, auth_headers, monkeypatch):
    token = _connect(client, auth_headers, monkeypatch, chat_id=222333444)
    db = SessionLocal()
    try:
        ok, message = link_from_start_message(db, {
            "chat": {"id": 222333444, "type": "private"},
            "from": {"id": 111222333, "username": "repeat_user"},
            "text": f"/start {token}",
        })
    finally:
        db.close()
    assert ok is False
    assert "недійсне" in message or "протерміноване" in message


def test_notifiable_bot_event_creates_delivery_outbox(client, auth_headers, monkeypatch):
    _connect(client, auth_headers, monkeypatch, chat_id=333444555)
    me = client.get("/api/auth/me", headers=auth_headers).json()
    created = client.post(
        "/api/bots",
        json={
            "name": "Telegram Event Bot",
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
    assert created.status_code == 201, created.text
    bot_id = created.json()["id"]

    db = SessionLocal()
    try:
        bot = db.get(TradingBot, bot_id)
        event = log_bot_event(db, bot, "bot_started", "Bot started in test")
        db.commit()
        delivery = db.query(TelegramNotificationDelivery).filter(
            TelegramNotificationDelivery.event_id == event.id,
            TelegramNotificationDelivery.user_id == me["id"],
        ).first()
        assert delivery is not None
        assert delivery.status == "queued"
    finally:
        db.close()
