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




def test_login_sets_refresh_cookie(client):
    email = f"cookie_{uuid.uuid4().hex[:10]}@test.dev"
    password = "secret123"
    client.post("/api/auth/register", json={"email": email, "password": password})

    resp = client.post("/api/auth/login", json={"email": email, "password": password})

    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]
    assert resp.json()["expires_in"] > 0
    assert client.cookies.get("atd_refresh_token")
    set_cookie = resp.headers.get("set-cookie", "").lower()
    assert "httponly" in set_cookie


def test_refresh_rotates_token_and_returns_new_access_token(client):
    email = f"refresh_{uuid.uuid4().hex[:10]}@test.dev"
    password = "secret123"
    client.post("/api/auth/register", json={"email": email, "password": password})
    login_resp = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    first_refresh = client.cookies.get("atd_refresh_token")
    first_access = login_resp.json()["access_token"]

    refresh_resp = client.post("/api/auth/refresh")

    assert refresh_resp.status_code == 200, refresh_resp.text
    assert refresh_resp.json()["access_token"]
    assert refresh_resp.json()["access_token"] != first_access
    second_refresh = client.cookies.get("atd_refresh_token")
    assert second_refresh
    assert second_refresh != first_refresh


def test_rotated_refresh_token_cannot_be_reused(client):
    email = f"reuse_{uuid.uuid4().hex[:10]}@test.dev"
    password = "secret123"
    client.post("/api/auth/register", json={"email": email, "password": password})
    client.post("/api/auth/login", json={"email": email, "password": password})
    old_refresh = client.cookies.get("atd_refresh_token")

    assert client.post("/api/auth/refresh").status_code == 200

    # Simulate an attacker trying the already-rotated token again.
    client.cookies.set("atd_refresh_token", old_refresh, path="/api/auth")
    reused = client.post("/api/auth/refresh")
    assert reused.status_code == 401


def test_logout_revokes_refresh_session(client):
    email = f"logout_{uuid.uuid4().hex[:10]}@test.dev"
    password = "secret123"
    client.post("/api/auth/register", json={"email": email, "password": password})
    client.post("/api/auth/login", json={"email": email, "password": password})
    refresh_token = client.cookies.get("atd_refresh_token")

    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 204, logout_resp.text

    client.cookies.set("atd_refresh_token", refresh_token, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401


def test_refresh_requires_cookie(client):
    client.cookies.clear()
    assert client.post("/api/auth/refresh").status_code == 401
