import uuid
import pytest

BOT_PAYLOAD = {
    "name": "Owner Grid Bot",
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


def _register(client) -> dict:
    email = f"iso_{uuid.uuid4().hex[:12]}@test.dev"
    password = "secret123"
    client.post("/api/auth/register", json={"email": email, "password": password})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture()
def other_headers(client):
    return _register(client)


@pytest.fixture()
def owned_bot(client, auth_headers):
    resp = client.post("/api/bots", json=BOT_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_other_user_does_not_see_bot_in_list(client, owned_bot, other_headers):
    listed = client.get("/api/bots", headers=other_headers)
    assert listed.status_code == 200
    assert all(bot["id"] != owned_bot["id"] for bot in listed.json())


def test_other_user_cannot_read_bot(client, owned_bot, other_headers):
    resp = client.get(f"/api/bots/{owned_bot['id']}", headers=other_headers)
    assert resp.status_code == 404, resp.text


@pytest.mark.parametrize(
    "suffix", ["position", "risk", "performance", "orders", "events"]
)
def test_other_user_cannot_read_bot_subresources(
    client, owned_bot, other_headers, suffix
):
    resp = client.get(f"/api/bots/{owned_bot['id']}/{suffix}", headers=other_headers)
    assert resp.status_code == 404, f"{suffix}: {resp.text}"


def test_other_user_cannot_update_bot(client, owned_bot, other_headers, auth_headers):
    resp = client.put(
        f"/api/bots/{owned_bot['id']}",
        json={**BOT_PAYLOAD, "name": "Hijacked"},
        headers=other_headers,
    )
    assert resp.status_code == 404, resp.text

    owner_view = client.get(f"/api/bots/{owned_bot['id']}", headers=auth_headers)
    assert owner_view.status_code == 200
    assert owner_view.json()["name"] == BOT_PAYLOAD["name"]


def test_other_user_cannot_delete_bot(client, owned_bot, other_headers, auth_headers):
    resp = client.delete(f"/api/bots/{owned_bot['id']}", headers=other_headers)
    assert resp.status_code == 404, resp.text
    assert (
        client.get(f"/api/bots/{owned_bot['id']}", headers=auth_headers).status_code
        == 200
    )


@pytest.mark.parametrize("action", ["start", "stop", "sync", "cancel-orders"])
def test_other_user_cannot_control_bot(client, owned_bot, other_headers, action):
    resp = client.post(f"/api/bots/{owned_bot['id']}/{action}", headers=other_headers)
    assert resp.status_code == 404, f"{action}: {resp.text}"


def test_owner_still_has_access(client, owned_bot, auth_headers):
    resp = client.get(f"/api/bots/{owned_bot['id']}", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == owned_bot["id"]
