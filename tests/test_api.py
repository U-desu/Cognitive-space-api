import uuid
import pytest
from fastapi.testclient import TestClient
from services.gateway.main import app


@pytest.fixture
def client():
    """Fresh TestClient for each test (isolated cookie jar)."""
    with TestClient(app) as c:
        yield c


# ──────────── Health ────────────

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ──────────── Auth ────────────

def test_auth_flow(client):
    """Full auth lifecycle: register → login → me → logout."""
    username = f"testuser_{uuid.uuid4().hex[:8]}"
    password = "testpassword123"
    email = f"{username}@example.com"

    # Register
    reg = client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": email},
    )
    assert reg.status_code == 200
    user_id = reg.json()["user"]["user_id"]
    assert user_id.startswith("usr_")

    # Login
    login = client.post(
        "/auth/login",
        json={"username": username, "password": password},
    )
    assert login.status_code == 200
    assert login.json()["user"]["user_id"] == user_id

    # Me (authenticated via cookie set by register/login)
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["user_id"] == user_id

    # Logout
    logout = client.post("/auth/logout")
    assert logout.status_code == 200

    # Me after logout
    me2 = client.get("/auth/me")
    assert me2.status_code == 200  # endpoint returns 200 with user: null
    assert me2.json()["user"] is None


# ──────────── Guest Space ────────────

def test_create_and_get_space_guest(client):
    payload = {
        "query": "我是否应该从大厂离职去做AI创业？",
        "user_context": {"industry": "tech", "seniority": "5y"},
    }
    resp = client.post("/spaces", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "space_id" in data
    assert len(data["agents"]) >= 3
    assert data.get("user_id") is None  # guest

    space_id = data["space_id"]
    get_resp = client.get(f"/spaces/{space_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["space_id"] == space_id


def test_compute_edges_guest(client):
    payload = {"query": "AI 会取代程序员吗？"}
    resp = client.post("/spaces", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    space_id = data["space_id"]
    n = len(data["agents"])
    edge_resp = client.post(f"/spaces/{space_id}/edges")
    assert edge_resp.status_code == 200
    data = edge_resp.json()
    assert "edges" in data
    assert "space_stats" in data
    assert len(data["edges"]) == n * (n - 1) // 2


def test_debate_guest(client):
    payload = {"query": "测试辩论"}
    resp = client.post("/spaces", json=payload)
    assert resp.status_code == 200
    space_id = resp.json()["space_id"]

    edge_resp = client.post(f"/spaces/{space_id}/edges")
    assert edge_resp.status_code == 200
    edges = edge_resp.json()["edges"]
    assert len(edges) > 0

    edge_id = edges[0]["edge_id"]
    debate_resp = client.post(
        f"/spaces/{space_id}/debates",
        json={"edge_id": edge_id, "rounds": 2},
    )
    assert debate_resp.status_code == 200
    data = debate_resp.json()
    assert "transcript" in data
    assert "synthesis" in data


def test_trajectory_guest(client):
    payload = {"query": "测试轨迹"}
    resp = client.post("/spaces", json=payload)
    assert resp.status_code == 200

    space_id = resp.json()["space_id"]
    traj_resp = client.get(f"/spaces/{space_id}/trajectory")
    assert traj_resp.status_code == 200
    data = traj_resp.json()
    assert data["space_id"] == space_id
    assert "path" in data


def test_export_guest(client):
    payload = {"query": "测试导出"}
    resp = client.post("/spaces", json=payload)
    assert resp.status_code == 200

    space_id = resp.json()["space_id"]
    export_resp = client.post(f"/spaces/{space_id}/export", json={"format": "json"})
    assert export_resp.status_code == 200
    assert "space" in export_resp.json()


# ──────────── Authenticated Space ────────────

def _register_and_login(client):
    """Helper: register a fresh user and login, return user_id."""
    username = f"testuser_{uuid.uuid4().hex[:8]}"
    password = "testpassword123"
    client.post(
        "/auth/register",
        json={"username": username, "password": password, "email": f"{username}@example.com"},
    )
    client.post("/auth/login", json={"username": username, "password": password})
    me = client.get("/auth/me")
    return me.json()["user"]["user_id"]


def test_create_space_authenticated_and_delete(client):
    """Authenticated user creates a space, sees it in my spaces, then deletes it."""
    user_id = _register_and_login(client)

    # Create space as authenticated user
    resp = client.post("/spaces", json={"query": "测试认证删除", "user_context": {}})
    assert resp.status_code == 200
    space_id = resp.json()["space_id"]
    assert resp.json().get("user_id") == user_id

    # My spaces should include it
    my_spaces = client.get("/spaces/my")
    assert my_spaces.status_code == 200
    space_ids = [s["space_id"] for s in my_spaces.json()]
    assert space_id in space_ids

    # Delete via Gateway
    del_resp = client.delete(f"/spaces/{space_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Space deleted"

    # My spaces should no longer include it
    my_spaces2 = client.get("/spaces/my")
    assert my_spaces2.status_code == 200
    space_ids2 = [s["space_id"] for s in my_spaces2.json()]
    assert space_id not in space_ids2

    # Logout
    client.post("/auth/logout")


def test_expand_agent(client):
    """Expand an existing agent in a space (requires auth)."""
    _register_and_login(client)

    resp = client.post("/spaces", json={"query": "测试展开Agent", "user_context": {}})
    assert resp.status_code == 200
    space_id = resp.json()["space_id"]
    agents = resp.json()["agents"]
    assert len(agents) > 0

    agent_id = agents[0]["agent_id"]
    expand_resp = client.post(
        f"/spaces/{space_id}/agents/{agent_id}/expand",
        json={"depth": 2},
    )
    assert expand_resp.status_code == 200
    expanded = expand_resp.json()
    assert expanded["space_id"] == space_id
    # After expand there should be more agents than before
    assert len(expanded["agents"]) > len(agents)

    client.post("/auth/logout")


def test_export_shareable_card(client):
    """Export a space in shareable_card format."""
    resp = client.post("/spaces", json={"query": "测试分享卡片", "user_context": {}})
    assert resp.status_code == 200
    space_id = resp.json()["space_id"]

    export_resp = client.post(
        f"/spaces/{space_id}/export",
        json={"format": "shareable_card", "include_trajectory": False},
    )
    assert export_resp.status_code == 200
    data = export_resp.json()
    assert "export_id" in data
    assert "share_url" in data
    assert "card_preview" in data
