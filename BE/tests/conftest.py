"""Test configuration: provides an isolated SQLite database and TestClient."""
import os
import tempfile
import uuid
from pathlib import Path

import pytest

# Force a sqlite database for tests *before* the app reads config.
TEST_DB_FILE = Path(tempfile.gettempdir()) / "algotrade_test.db"
if TEST_DB_FILE.exists():
    TEST_DB_FILE.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"
os.environ["BOT_WORKER_ENABLED"] = "false"
os.environ["RATE_LIMIT_ENABLED"] = "false"


@pytest.fixture(scope="session")
def app():
    from app.core.config import get_settings
    get_settings.cache_clear()
    from app.main import app  # noqa: E402
    return app


@pytest.fixture()
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture()
def auth_headers(client):
    """Register + login a fresh user; return Authorization headers."""
    email = f"user_{uuid.uuid4().hex[:12]}@test.dev"
    password = "secret123"
    client.post("/api/auth/register",
                json={"email": email, "password": password})
    resp = client.post("/api/auth/login",
                       json={"email": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
