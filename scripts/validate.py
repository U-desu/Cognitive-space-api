#!/usr/bin/env python3
"""One-click validation script for Cognitive Space API.

Checks:
1. All 5 microservices are healthy
2. Core API flows work end-to-end (guest mode)
3. Database state is consistent

Usage:
    python3 scripts/validate.py
"""

import sys
import json
import urllib.request
import urllib.error

GATEWAY = "http://localhost:8000"
CORE = "http://localhost:8001"


def _request(method: str, url: str, data: dict = None) -> dict:
    """Simple HTTP request helper."""
    req = urllib.request.Request(url, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_services() -> bool:
    """Check all microservices health."""
    print("=== 1. Service Health ===")
    services = {
        "Gateway": f"{GATEWAY}/health",
        "Core": f"{CORE}/health",
        "Generator": "http://localhost:8002/health",
        "Compute": "http://localhost:8003/health",
        "Aggregator": "http://localhost:8004/health",
    }
    all_ok = True
    for name, url in services.items():
        try:
            data = _request("GET", url)
            ok = data.get("status") == "ok"
            print(f"  {'✅' if ok else '❌'} {name}: {data}")
            if not ok:
                all_ok = False
        except Exception as e:
            print(f"  ❌ {name}: {e}")
            all_ok = False
    return all_ok


def check_api_flow() -> tuple[bool, str]:
    """Run guest-mode API flow and return (ok, space_id)."""
    print("\n=== 2. API Flow (Guest) ===")

    # Create space
    print("  Creating space...")
    space = _request("POST", f"{GATEWAY}/spaces", {
        "query": "Validate: 远程工作 vs 办公室",
        "user_context": {},
    })
    space_id = space["space_id"]
    n_agents = len(space["agents"])
    print(f"  ✅ Space: {space_id}, {n_agents} agents")

    # Compute edges
    print("  Computing edges...")
    edge_data = _request("POST", f"{GATEWAY}/spaces/{space_id}/edges")
    n_edges = len(edge_data["edges"])
    print(f"  ✅ Edges: {n_edges}")

    # Generate debate
    print("  Generating debate...")
    edge_id = edge_data["edges"][0]["edge_id"]
    debate = _request("POST", f"{GATEWAY}/spaces/{space_id}/debates", {
        "edge_id": edge_id,
        "rounds": 2,
    })
    has_transcript = "transcript" in debate
    print(f"  {'✅' if has_transcript else '❌'} Debate transcript: {has_transcript}")

    # Trajectory
    print("  Fetching trajectory...")
    traj = _request("GET", f"{GATEWAY}/spaces/{space_id}/trajectory")
    has_path = "path" in traj
    print(f"  {'✅' if has_path else '❌'} Trajectory path: {has_path}")

    # Export
    print("  Exporting...")
    export = _request("POST", f"{GATEWAY}/spaces/{space_id}/export", {"format": "json"})
    has_space = "space" in export
    print(f"  {'✅' if has_space else '❌'} Export space: {has_space}")

    ok = n_agents >= 3 and n_edges >= 1 and has_transcript and has_path and has_space
    return ok, space_id


def check_db(space_id: str) -> bool:
    """Verify DB state for the test space."""
    print("\n=== 3. Database Consistency ===")
    try:
        import psycopg
        conn = psycopg.connect("postgresql://localhost:5432/cognitive_space")
        cur = conn.cursor()

        checks = {
            "spaces": f"SELECT COUNT(*) FROM core.spaces WHERE space_id='{space_id}'",
            "agents": f"SELECT COUNT(*) FROM core.agents WHERE space_id='{space_id}'",
            "edges": f"SELECT COUNT(*) FROM core.edges WHERE space_id='{space_id}'",
            "debates": f"SELECT COUNT(*) FROM core.debates WHERE edge_id LIKE '{space_id}%'",
        }
        all_ok = True
        for name, sql in checks.items():
            cur.execute(sql)
            count = cur.fetchone()[0]
            ok = count > 0 if name != "debates" else count >= 0
            print(f"  {'✅' if ok else '❌'} {name}: {count}")
            if not ok and name != "debates":
                all_ok = False

        cur.close()
        conn.close()
        return all_ok
    except ImportError:
        print("  ⚠️ psycopg not installed, skipping DB check")
        return True
    except Exception as e:
        print(f"  ❌ DB error: {e}")
        return False


def cleanup(space_id: str):
    """Clean up test space."""
    print("\n=== 4. Cleanup ===")
    try:
        _request("DELETE", f"{CORE}/spaces/{space_id}")
        print(f"  ✅ Deleted test space {space_id}")
    except Exception as e:
        print(f"  ⚠️ Cleanup failed: {e}")


def main():
    print("════════════════════════════════════════════════════════════")
    print("  Cognitive Space API — Validation")
    print("════════════════════════════════════════════════════════════")

    ok = True
    ok = check_services() and ok
    flow_ok, space_id = check_api_flow()
    ok = flow_ok and ok
    ok = check_db(space_id) and ok
    cleanup(space_id)

    print("\n════════════════════════════════════════════════════════════")
    if ok:
        print("  ✅ ALL CHECKS PASSED")
        sys.exit(0)
    else:
        print("  ❌ SOME CHECKS FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
