"""Focused integration tests for the in-memory rate-limit middleware."""
import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.rate_limit import RateLimitMiddleware


def _test_app(**overrides) -> TestClient:
    settings = Settings(
        _env_file=None,
        rate_limit_enabled=True,
        rate_limit_login_requests=2,
        rate_limit_login_window_seconds=60,
        rate_limit_register_requests=2,
        rate_limit_register_window_seconds=60,
        rate_limit_refresh_requests=2,
        rate_limit_refresh_window_seconds=60,
        rate_limit_api_requests=2,
        rate_limit_api_window_seconds=60,
        rate_limit_api_write_requests=2,
        rate_limit_api_write_window_seconds=60,
        **overrides,
    )
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, settings=settings)

    @app.post("/api/auth/login")
    def login():
        return {"ok": True}

    @app.post("/api/auth/refresh")
    def refresh():
        return {"ok": True}

    @app.get("/api/items")
    def items():
        return {"ok": True}

    @app.post("/api/items")
    def create_item():
        return {"ok": True}

    @app.get("/health")
    def health():
        return {"ok": True}

    return TestClient(app)


def test_login_is_limited_and_returns_retry_headers():
    client = _test_app()

    assert client.post("/api/auth/login").status_code == 200
    second = client.post("/api/auth/login")
    assert second.status_code == 200
    assert second.headers["x-ratelimit-remaining"] == "0"

    blocked = client.post("/api/auth/login")
    assert blocked.status_code == 429
    assert blocked.json()["rate_limit"]["scope"] == "auth_login"
    assert blocked.headers["retry-after"]
    assert blocked.headers["x-ratelimit-limit"] == "2"
    assert blocked.headers["x-ratelimit-remaining"] == "0"


def test_read_and_write_budgets_are_separate():
    client = _test_app()

    assert client.get("/api/items").status_code == 200
    assert client.get("/api/items").status_code == 200
    assert client.get("/api/items").status_code == 429

    # Write scope has its own counter, so reads do not consume it.
    assert client.post("/api/items").status_code == 200
    assert client.post("/api/items").status_code == 200
    assert client.post("/api/items").status_code == 429


def test_non_api_health_endpoint_is_not_rate_limited():
    client = _test_app()

    for _ in range(10):
        assert client.get("/health").status_code == 200


def test_authenticated_users_have_separate_api_budgets():
    client = _test_app()
    secret = "dev-secret-change-me-0123456789abcdef0123456789abcdef"

    token_one = jwt.encode({"sub": "101", "type": "access"}, secret, algorithm="HS256")
    token_two = jwt.encode({"sub": "202", "type": "access"}, secret, algorithm="HS256")
    headers_one = {"Authorization": f"Bearer {token_one}"}
    headers_two = {"Authorization": f"Bearer {token_two}"}

    assert client.get("/api/items", headers=headers_one).status_code == 200
    assert client.get("/api/items", headers=headers_one).status_code == 200
    assert client.get("/api/items", headers=headers_one).status_code == 429

    # Same source IP, different authenticated user -> separate limiter bucket.
    assert client.get("/api/items", headers=headers_two).status_code == 200
