from __future__ import annotations

import hashlib
import hmac
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

from app.bot_engine.exchange_streams import _auth_payload, stream_endpoints
from app.core.config import get_settings


def _bot(**overrides):
    values = {
        "id": 1,
        "environment": "emulator",
        "category": "linear",
        "symbol": "BTCUSDT",
        "settings": {"emulator_api_key": "emu-key"},
        "strategy_type": "grid",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_emulator_uses_bybit_like_public_and_private_ws_paths(monkeypatch):
    monkeypatch.setenv("EXCHANGE_EMULATOR_URL", "http://exchange-emulator:8001")
    get_settings.cache_clear()
    endpoints = stream_endpoints(_bot())
    assert endpoints.emulator is True
    assert urlparse(endpoints.public_url).path == "/v5/public/linear"
    assert urlparse(endpoints.private_url).path == "/v5/private"
    assert parse_qs(urlparse(endpoints.public_url).query)["api_key"] == ["emu-key"]
    assert parse_qs(urlparse(endpoints.private_url).query)["api_key"] == ["emu-key"]


def test_bybit_demo_uses_mainnet_public_and_demo_private(monkeypatch):
    monkeypatch.setenv("BYBIT_DEMO_API_KEY", "demo-key")
    monkeypatch.setenv("BYBIT_DEMO_API_SECRET", "demo-secret")
    get_settings.cache_clear()
    endpoints = stream_endpoints(_bot(environment="demo", settings={}))
    assert endpoints.public_url == "wss://stream.bybit.com/v5/public/linear"
    assert endpoints.private_url == "wss://stream-demo.bybit.com/v5/private"
    assert endpoints.api_key == "demo-key"
    assert endpoints.api_secret == "demo-secret"


def test_private_auth_payload_is_bybit_hmac(monkeypatch):
    monkeypatch.setattr("app.bot_engine.exchange_streams.time.time", lambda: 1000.0)
    payload = _auth_payload("key", "secret")
    expires = 1_010_000
    expected = hmac.new(b"secret", f"GET/realtime{expires}".encode(), hashlib.sha256).hexdigest()
    assert payload == {"op": "auth", "args": ["key", expires, expected]}
