import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_create_and_get_space():
    # This test requires OPENAI_API_KEY to be set
    payload = {
        "query": "我是否应该从大厂离职去做AI创业？",
        "user_context": {"industry": "tech", "seniority": "5y"},
    }
    resp = client.post("/spaces", json=payload)
    if resp.status_code != 200:
        pytest.skip(f"LLM call failed or no API key: {resp.text}")

    data = resp.json()
    assert "space_id" in data
    assert len(data["agents"]) >= 3

    space_id = data["space_id"]
    get_resp = client.get(f"/spaces/{space_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["space_id"] == space_id


def test_compute_edges():
    payload = {"query": "AI 会取代程序员吗？"}
    resp = client.post("/spaces", json=payload)
    if resp.status_code != 200:
        pytest.skip(f"LLM call failed: {resp.text}")

    space_id = resp.json()["space_id"]
    edge_resp = client.post(f"/spaces/{space_id}/edges")
    assert edge_resp.status_code == 200
    data = edge_resp.json()
    assert "edges" in data
    assert "space_stats" in data
    assert len(data["edges"]) > 0


def test_trajectory():
    payload = {"query": "测试问题"}
    resp = client.post("/spaces", json=payload)
    if resp.status_code != 200:
        pytest.skip(f"LLM call failed: {resp.text}")

    space_id = resp.json()["space_id"]
    traj_resp = client.get(f"/spaces/{space_id}/trajectory")
    assert traj_resp.status_code == 200
    data = traj_resp.json()
    assert data["space_id"] == space_id
    assert "path" in data


def test_export():
    payload = {"query": "测试导出"}
    resp = client.post("/spaces", json=payload)
    if resp.status_code != 200:
        pytest.skip(f"LLM call failed: {resp.text}")

    space_id = resp.json()["space_id"]
    export_resp = client.post(f"/spaces/{space_id}/export", json={"format": "json"})
    assert export_resp.status_code == 200
    assert "space" in export_resp.json()
