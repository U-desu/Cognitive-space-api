"""API Gateway - Unified Entry Point.

Port: 8000
Responsibility:
- Route requests to downstream services
- Orchestrate multi-service workflows (space creation, debate generation)
- Aggregate responses for frontend convenience
- CORS handling for frontend

Service map:
- /spaces/*       -> Core Service (8001)
- /generator/*    -> Generator Service (8002)
- /compute/*      -> Compute Service (8003)
- /aggregator/*   -> Aggregator Service (8004)

Orchestrated endpoints (frontend-facing):
- POST /spaces              -> generate agents + store space
- POST /spaces/{id}/edges   -> compute edges (calls compute service)
- POST /spaces/{id}/debates -> generate debate + store debate
- GET  /spaces/{id}/trajectory -> get trajectory + compute metrics
"""

import uuid
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, StreamingResponse
import httpx

from services.shared import config
from services.shared.models import (
    Space, CreateSpaceRequest, Agent,
    Dimension, SpaceMetadata,
    DebateRequest, Debate,
    Edge, SpaceStats,
    Trajectory, RecordActionRequest,
    ExportRequest,
    User, UserRegisterRequest, UserLoginRequest,
    ExpandAgentRequest,
    AgentExpandPayload,
)
from services.gateway.dependencies import get_current_user, require_user
from typing import Optional
from services.gateway.auth.jwt import create_access_token, COOKIE_NAME
from services.gateway.auth.password_auth import register_user, authenticate_user
from services.gateway.auth.github_oauth import get_github_authorize_url, handle_github_callback
from services.gateway.auth.zhihu_oauth import get_zhihu_authorize_url, handle_zhihu_callback
from services.gateway.auth.store import get_user, link_space_to_user, get_user_spaces


app = FastAPI(
    title="Cognitive Space API Gateway",
    description="多智能体辩论与认知扩展系统",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        config.FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: HTTP client ──

async def _require_space_owner(space_id: str, user_id: str):
    """Verify the user owns the given space. Raises 403 if not."""
    data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    space = Space(**data)
    if space.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not owner of this space")
    return space


async def _post(service_url: str, path: str, json_data: dict = None):
    async with httpx.AsyncClient(trust_env=False) as client:
        resp = await client.post(f"{service_url}{path}", json=json_data, timeout=60.0)
        resp.raise_for_status()
        return resp.json()


async def _get(service_url: str, path: str):
    async with httpx.AsyncClient(trust_env=False) as client:
        resp = await client.get(f"{service_url}{path}", timeout=30.0)
        resp.raise_for_status()
        return resp.json()


async def _delete(service_url: str, path: str):
    async with httpx.AsyncClient(trust_env=False) as client:
        resp = await client.delete(f"{service_url}{path}", timeout=30.0)
        resp.raise_for_status()
        return resp.json()


# ── Orchestrated: Space Creation ──

@app.post("/spaces", response_model=Space)
async def create_space(
    request: CreateSpaceRequest,
    user: dict = Depends(require_user),
):
    """Orchestrated space creation with deduplication:
    1. Check for similar existing space (owner-scoped)
    2. If found, return existing space
    3. Otherwise: generate agents + store space
    4. Link to user
    """
    owner_id = user["user_id"]

    # 1. Compute query embedding for deduplication
    try:
        embed_resp = await _post(
            config.COMPUTE_URL,
            "/compute/embed",
            {"text": request.query},
        )
        query_embedding = embed_resp.get("embedding", [])
    except Exception:
        # If embedding fails, proceed without dedup
        query_embedding = []

    # 2. Check for similar existing space
    if query_embedding:
        try:
            dedup_resp = await _post(
                config.CORE_URL,
                "/spaces/similarity-search",
                {
                    "owner_id": owner_id,
                    "query_embedding": query_embedding,
                    "threshold": 0.85,
                },
            )
            if dedup_resp.get("matched"):
                existing_space = Space(**dedup_resp["space"])
                # Return with header indicating reuse
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    content=existing_space.model_dump(),
                    headers={"X-Space-Reused": "true", "X-Space-Similarity": str(dedup_resp.get("similarity", 0))},
                )
        except Exception:
            # If dedup check fails, proceed with creation
            pass

    # 3. Generate agents
    gen_resp = await _post(
        config.GENERATOR_URL,
        "/generator/agents/generate",
        {"query": request.query, "user_context": request.user_context},
    )
    agents_raw = gen_resp.get("agents", [])
    agents = [Agent(**a) for a in agents_raw]

    # 4. Construct space
    space_id = f"space_{uuid.uuid4().hex[:8]}"
    space = Space(
        space_id=space_id,
        query=request.query,
        dimensions={
            "x": Dimension(name="authority", label="权威度", range=[0.0, 1.0]),
            "y": Dimension(name="novelty", label="创新度", range=[0.0, 1.0]),
        },
        agents=agents,
        metadata=SpaceMetadata(
            space_type="general",
            complexity="high" if len(agents) > 4 else "medium",
            estimated_nodes=len(agents),
        ),
        user_id=owner_id,
        query_embedding=query_embedding if query_embedding else None,
    )

    # 5. Store in core
    await _post(config.CORE_URL, "/spaces/ingest", space.model_dump())

    # 6. Link to user
    link_space_to_user(owner_id, space_id)

    return space


# ── My Spaces (must be before /spaces/{space_id}) ──

@app.get("/spaces/my")
async def get_my_spaces(user: dict = Depends(require_user)):
    """Get spaces created by the current logged-in user."""
    space_ids = get_user_spaces(user["user_id"])
    spaces = []
    for sid in space_ids:
        data = await _get(config.CORE_URL, f"/spaces/{sid}")
        spaces.append(Space(**data))
    return spaces


@app.get("/spaces/history")
async def get_space_history(user: dict = Depends(require_user)):
    """Get space history for the current user."""
    spaces_data = await _get(config.CORE_URL, f"/spaces/history/{user['user_id']}")
    return [Space(**s) for s in spaces_data]


@app.get("/spaces/{space_id}", response_model=Space)
async def get_space(space_id: str, user: dict = Depends(require_user)):
    space = await _require_space_owner(space_id, user["user_id"])
    return space


@app.delete("/spaces/{space_id}")
async def delete_space(space_id: str, user: dict = Depends(require_user)):
    """Delete a space (owner only)."""
    await _require_space_owner(space_id, user["user_id"])
    data = await _delete(config.CORE_URL, f"/spaces/{space_id}")
    return data


# ── Orchestrated: Edge Computation ──

@app.post("/spaces/{space_id}/edges")
async def compute_edges(space_id: str, user: dict = Depends(require_user)):
    """Orchestrated edge computation:
    1. Call compute service to calculate edges
    2. Store edges in core service
    3. Return edges + stats
    """
    await _require_space_owner(space_id, user["user_id"])

    # Compute
    data = await _post(
        config.COMPUTE_URL,
        "/compute/edges/compute",
        {"space_id": space_id},
    )
    edges_raw = data.get("edges", [])
    stats_raw = data.get("space_stats", {})
    edges = [Edge(**e) for e in edges_raw]
    stats = SpaceStats(**stats_raw)

    # Store
    await _post(
        config.CORE_URL,
        f"/spaces/{space_id}/edges",
        {"edges": [e.model_dump() for e in edges]},
    )

    return {"edges": [e.model_dump() for e in edges], "space_stats": stats.model_dump()}


# ── Orchestrated: Debate Generation ──

@app.post("/spaces/{space_id}/debates")
async def create_debate(space_id: str, request: DebateRequest, user: dict = Depends(require_user)):
    """Orchestrated debate generation:
    1. Fetch space + edge from core
    2. Call generator to generate debate
    3. Store debate in core
    4. Record trajectory action
    5. Compute + update metrics
    """
    # Verify ownership and fetch space + edge
    space = await _require_space_owner(space_id, user["user_id"])
    space_data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    space = Space(**space_data)

    edge_data = await _get(config.CORE_URL, f"/spaces/{space_id}/edges/{request.edge_id}")
    edge = Edge(**edge_data)

    agent_map = {a.agent_id: a for a in space.agents}
    agent_a = agent_map.get(edge.source)
    agent_b = agent_map.get(edge.target)
    if not agent_a or not agent_b:
        raise HTTPException(status_code=400, detail="Edge agents not found in space")

    # Generate debate
    debate_data = await _post(
        config.GENERATOR_URL,
        "/generator/debates/generate",
        {
            "space_id": space_id,
            "edge_id": edge.edge_id,
            "agent_a": agent_a.model_dump(),
            "agent_b": agent_b.model_dump(),
            "edge": edge.model_dump(),
            "debate_request": request.model_dump(),
        },
    )
    debate = Debate(**debate_data)
    debate.space_id = space_id

    # Store debate
    await _post(config.CORE_URL, "/debates/ingest", debate.model_dump())

    # Update edge with shared_ground / divergence_axes from debate
    edge.shared_ground = debate.synthesis.agreement_points
    edge.divergence_axes = [
        {"axis": d, "a_stance": "", "b_stance": ""}
        for d in debate.synthesis.divergence_points
    ]
    # Note: In full implementation, core service should have update_edge endpoint

    # Record trajectory
    await _post(
        config.CORE_URL,
        "/trajectories/actions",
        {"space_id": space_id, "node": request.edge_id, "action": "debate", "dwell_time": 45},
    )

    # Compute metrics
    traj_data = await _get(config.CORE_URL, f"/trajectories/{space_id}")
    trajectory = Trajectory(**traj_data)

    metrics_data = await _post(
        config.COMPUTE_URL,
        "/compute/metrics/compute",
        {
            "space": space.model_dump(),
            "trajectory": trajectory.model_dump(),
        },
    )

    # Update trajectory in core
    trajectory.cognitive_metrics = metrics_data["metrics"]
    trajectory.journey_stage = metrics_data["journey_stage"]
    trajectory.suggested_next = metrics_data["suggested_next"]
    await _post(config.CORE_URL, "/trajectories/actions", {
        "space_id": space_id,
        "node": request.edge_id,
        "action": "debate",
        "dwell_time": 45,
    })

    return debate


# ── Orchestrated: Debate Generation (SSE Stream) ──

@app.post("/spaces/{space_id}/debates/stream")
async def create_debate_stream(space_id: str, request: DebateRequest, user: dict = Depends(require_user)):
    """Stream debate generation via SSE.

    Proxies the Generator's /generate-stream endpoint, pushing each turn
    to the frontend as it is generated by the independent debate agents.
    """
    # Verify ownership and fetch space + edge (same as sync endpoint)
    await _require_space_owner(space_id, user["user_id"])
    space_data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    space = Space(**space_data)

    edge_data = await _get(config.CORE_URL, f"/spaces/{space_id}/edges/{request.edge_id}")
    edge = Edge(**edge_data)

    agent_map = {a.agent_id: a for a in space.agents}
    agent_a = agent_map.get(edge.source)
    agent_b = agent_map.get(edge.target)
    if not agent_a or not agent_b:
        raise HTTPException(status_code=400, detail="Edge agents not found in space")

    payload = {
        "space_id": space_id,
        "edge_id": edge.edge_id,
        "agent_a": agent_a.model_dump(),
        "agent_b": agent_b.model_dump(),
        "edge": edge.model_dump(),
        "debate_request": request.model_dump(),
    }

    async def event_stream():
        async with httpx.AsyncClient(trust_env=False) as client:
            async with client.stream(
                "POST",
                f"{config.GENERATOR_URL}/generator/debates/generate-stream",
                json=payload,
                timeout=120.0,
            ) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes():
                    yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Orchestrated: Trajectory ──

@app.get("/spaces/{space_id}/trajectory")
async def get_trajectory(space_id: str, user: dict = Depends(require_user)):
    await _require_space_owner(space_id, user["user_id"])
    space_data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    space = Space(**space_data)

    traj_data = await _get(config.CORE_URL, f"/trajectories/{space_id}")
    trajectory = Trajectory(**traj_data)

    metrics_data = await _post(
        config.COMPUTE_URL,
        "/compute/metrics/compute",
        {
            "space": space.model_dump(),
            "trajectory": trajectory.model_dump(),
        },
    )

    trajectory.cognitive_metrics = metrics_data["metrics"]
    trajectory.journey_stage = metrics_data["journey_stage"]
    trajectory.suggested_next = metrics_data["suggested_next"]

    return trajectory


# ── Perspectives (lightweight, no LLM) ──

@app.post("/spaces/{space_id}/perspectives")
async def generate_perspectives(space_id: str, payload: dict, user: dict = Depends(require_user)):
    await _require_space_owner(space_id, user["user_id"])
    space_data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    space = Space(**space_data)

    agent_ids = payload.get("agent_ids", [])
    result = []
    for agent in space.agents:
        if not agent_ids or agent.agent_id in agent_ids:
            result.append({
                "agent_id": agent.agent_id,
                "content": agent.summary,
                "key_claims": [{"claim": agent.summary, "confidence": agent.confidence}],
                "evidence": [],
                "position": agent.position.model_dump(),
            })

    return {"perspectives": result, "generation_metrics": {"latency_ms": 0, "total_tokens": 0}}


# ── Export ──

@app.post("/spaces/{space_id}/export")
async def export_space(space_id: str, payload: ExportRequest, user: dict = Depends(require_user)):
    await _require_space_owner(space_id, user["user_id"])
    data = await _post(
        config.CORE_URL,
        f"/spaces/{space_id}/export",
        payload.model_dump(),
    )
    return data


# ── Passthrough: Aggregator ──

@app.get("/aggregator/zhihu/users")
async def get_zhihu_users(domain: str):
    data = await _get(config.AGGREGATOR_URL, f"/aggregator/zhihu/users?domain={domain}")
    return data


@app.get("/aggregator/zhihu/questions")
async def get_zhihu_questions(query: str):
    data = await _get(config.AGGREGATOR_URL, f"/aggregator/zhihu/questions?query={query}")
    return data


@app.get("/aggregator/presets/hot-questions")
async def get_hot_questions():
    data = await _get(config.AGGREGATOR_URL, "/aggregator/presets/hot-questions")
    return data


@app.get("/aggregator/domain-labels")
async def get_domain_labels():
    data = await _get(config.AGGREGATOR_URL, "/aggregator/domain-labels")
    return data


# ── Auth Routes ──

# ── 知乎 OAuth (唯一登录方式) ──

@app.get("/auth/zhihu/authorize")
async def zhihu_authorize():
    """Return Zhihu OAuth authorization URL."""
    return {"url": get_zhihu_authorize_url()}


@app.get("/auth/zhihu/callback")
async def zhihu_callback(code: Optional[str] = None, authorization_code: Optional[str] = None):
    """Handle Zhihu OAuth callback."""
    # 知乎回调可能使用 code 或 authorization_code 参数名
    actual_code = code or authorization_code
    if not actual_code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    user = await handle_zhihu_callback(actual_code)
    if not user:
        raise HTTPException(status_code=400, detail="Zhihu authentication failed")
    token = create_access_token(user.user_id)
    response = RedirectResponse(url=config.FRONTEND_URL)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return response


# ── 以下登录方式已屏蔽 ──

@app.get("/auth/github/authorize")
async def github_authorize():
    raise HTTPException(status_code=403, detail="GitHub login is disabled")


@app.get("/auth/github/callback")
async def github_callback(code: str):
    raise HTTPException(status_code=403, detail="GitHub login is disabled")


@app.post("/auth/register")
async def auth_register(request: UserRegisterRequest):
    raise HTTPException(status_code=403, detail="Username/password registration is disabled")


@app.post("/auth/login")
async def auth_login(request: UserLoginRequest):
    raise HTTPException(status_code=403, detail="Username/password login is disabled")


@app.get("/auth/me")
async def auth_me(user: Optional[dict] = Depends(get_current_user)):
    """Get current logged-in user info."""
    if not user:
        return {"user": None}
    full_user = get_user(user["user_id"])
    return {"user": full_user.model_dump() if full_user else None}


@app.post("/auth/logout")
async def auth_logout():
    """Logout and clear JWT cookie."""
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key=COOKIE_NAME)
    return response


# ── Orchestrated: Agent Expansion ──

@app.post("/spaces/{space_id}/agents/{agent_id}/expand", response_model=Space)
async def expand_agent(
    space_id: str,
    agent_id: str,
    request: AgentExpandPayload,
    user: dict = Depends(require_user),
):
    """Orchestrated agent expansion:
    1. Fetch space + parent agent from core
    2. Call generator to create child agents
    3. Append new agents to space
    4. Re-compute edges for the expanded space
    5. Return updated space
    """
    # 1. Fetch space (verify ownership)
    await _require_space_owner(space_id, user["user_id"])
    space_data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    space = Space(**space_data)

    # 2. Find parent agent
    parent_agent = next((a for a in space.agents if a.agent_id == agent_id), None)
    if not parent_agent:
        raise HTTPException(status_code=404, detail="Agent not found in space")

    # 3. Call generator to expand
    expand_payload = {
        "parent_agent": parent_agent.model_dump(),
        "query_hint": request.query_hint,
        "num_agents": request.num_agents,
        "user_context": None,
    }
    expand_resp = await _post(
        config.GENERATOR_URL,
        "/generator/agents/expand",
        expand_payload,
    )
    new_agents_raw = expand_resp.get("new_agents", [])
    new_agents = [Agent(**a) for a in new_agents_raw]

    if not new_agents:
        return space

    # 4. Append new agents to space via core
    await _post(
        config.CORE_URL,
        f"/spaces/{space_id}/agents",
        [a.model_dump() for a in new_agents],
    )

    # 5. Re-compute and store edges for expanded space
    edges_data = await _post(
        config.COMPUTE_URL,
        "/compute/edges/compute",
        {"space_id": space_id},
    )
    edges_raw = edges_data.get("edges", [])
    edges = [Edge(**e) for e in edges_raw]
    await _post(
        config.CORE_URL,
        f"/spaces/{space_id}/edges",
        {"edges": [e.model_dump() for e in edges]},
    )

    # 6. Fetch updated space
    updated_data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    return Space(**updated_data)


# ── Debate History ──

@app.get("/debates/by-edge/{edge_id}")
async def get_debates_by_edge(edge_id: str):
    """Get debate history for a given edge."""
    return await _get(config.CORE_URL, f"/debates/by-edge/{edge_id}")


# ── Health ──

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "gateway"}
