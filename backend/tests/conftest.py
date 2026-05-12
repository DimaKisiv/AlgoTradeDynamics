"""Test configuration: provides an isolated SQLite database and TestClient."""
import os
import tempfile
from pathlib import Path

import pytest

# Force a sqlite database for tests *before* the app reads config.
TEST_DB_FILE = Path(tempfile.gettempdir()) / "algotrade_test.db"
if TEST_DB_FILE.exists():
    TEST_DB_FILE.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"


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
