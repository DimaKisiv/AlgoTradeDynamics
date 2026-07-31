"""Tests for authentication, account and per-user data isolation."""
import uuid


def _register_and_login(client, password="secret123"):
    email = f"user_{uuid.uuid4().hex[:12]}@test.dev"
    client.post("/api/auth/register", json={"email": email, "password": password})
    token = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).json()["access_token"]
    return email, {"Authorization": f"Bearer {token}"}


def test_register_returns_user(client):
    email = f"reg_{uuid.uuid4().hex[:10]}@test.dev"
    resp = client.post("/api/auth/register", json={"email": email, "password": "secret123"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["email"] == email
    assert body["id"] > 0
    assert body["runs_count"] == 0
    assert "hashed_password" not in body  # Never expose the password hash


def test_register_duplicate_email_conflict(client):
    email = f"dup_{uuid.uuid4().hex[:10]}@test.dev"
    first = client.post("/api/auth/register", json={"email": email, "password": "secret123"})
    assert first.status_code == 201
    second = client.post("/api/auth/register", json={"email": email, "password": "secret123"})
    assert second.status_code == 409


def test_register_short_password_rejected(client):
    email = f"short_{uuid.uuid4().hex[:10]}@test.dev"
    resp = client.post("/api/auth/register", json={"email": email, "password": "123"})
    assert resp.status_code == 422


def test_login_wrong_password(client):
    email, _ = _register_and_login(client)
    resp = client.post("/api/auth/login", json={"email": email, "password": "WRONG"})
    assert resp.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_current_user(client):
    email, headers = _register_and_login(client)
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == email


def test_invalid_token_rejected(client):
    headers = {"Authorization": "Bearer not-a-real-token"}
    assert client.get("/api/auth/me", headers=headers).status_code == 401


