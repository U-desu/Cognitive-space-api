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
from fastapi.responses import RedirectResponse, JSONResponse
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
)
from services.gateway.dependencies import get_current_user, require_user
from services.gateway.auth.jwt import create_access_token, COOKIE_NAME
from services.gateway.auth.password_auth import register_user, authenticate_user
from services.gateway.auth.github_oauth import get_github_authorize_url, handle_github_callback
from services.gateway.auth.store import get_user, link_space_to_user, get_user_spaces


app = FastAPI(
    title="Cognitive Space API Gateway",
    description="多智能体辩论与认知扩展系统",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: HTTP client ──

async def _post(service_url: str, path: str, json_data: dict = None):
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{service_url}{path}", json=json_data, timeout=60.0)
        resp.raise_for_status()
        return resp.json()


async def _get(service_url: str, path: str):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{service_url}{path}", timeout=30.0)
        resp.raise_for_status()
        return resp.json()


# ── Orchestrated: Space Creation ──

@app.post("/spaces", response_model=Space)
async def create_space(request: CreateSpaceRequest, user: dict = Depends(require_user)):
    """Orchestrated space creation:
    1. Call generator to create agents
    2. Construct Space object
    3. Store in core service
    """
    # 1. Generate agents
    gen_resp = await _post(
        config.GENERATOR_URL,
        "/generator/agents/generate",
        {"query": request.query, "user_context": request.user_context},
    )
    agents_raw = gen_resp.get("agents", [])
    agents = [Agent(**a) for a in agents_raw]

    # 2. Construct space
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
        user_id=user["user_id"],
    )

    # 3. Store in core
    await _post(config.CORE_URL, "/spaces/ingest", space.model_dump())

    # 4. Link to user
    link_space_to_user(user["user_id"], space_id)

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


@app.get("/spaces/{space_id}", response_model=Space)
async def get_space(space_id: str, user: dict = Depends(require_user)):
    data = await _get(config.CORE_URL, f"/spaces/{space_id}")
    return Space(**data)


# ── Orchestrated: Edge Computation ──

@app.post("/spaces/{space_id}/edges")
async def compute_edges(space_id: str, user: dict = Depends(require_user)):
    """Orchestrated edge computation:
    1. Call compute service to calculate edges
    2. Store edges in core service
    3. Return edges + stats
    """
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
    # Fetch space and edge
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


# ── Orchestrated: Trajectory ──

@app.get("/spaces/{space_id}/trajectory")
async def get_trajectory(space_id: str, user: dict = Depends(require_user)):
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

@app.get("/auth/github/authorize")
async def github_authorize():
    """Return GitHub OAuth authorization URL."""
    return {"url": get_github_authorize_url()}


@app.get("/auth/github/callback")
async def github_callback(code: str):
    """Handle GitHub OAuth callback."""
    user = await handle_github_callback(code)
    if not user:
        raise HTTPException(status_code=400, detail="GitHub authentication failed")
    token = create_access_token(user.user_id)
    response = RedirectResponse(url="/")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # Set True in production with HTTPS
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return response


@app.post("/auth/register")
async def auth_register(request: UserRegisterRequest):
    """Register a new user with username and password."""
    try:
        user = register_user(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = create_access_token(user.user_id)
    response = JSONResponse(content={"user": user.model_dump()})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return response


@app.post("/auth/login")
async def auth_login(request: UserLoginRequest):
    """Login with username and password."""
    user = authenticate_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user.user_id)
    response = JSONResponse(content={"user": user.model_dump()})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return response


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


# ── Health ──

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "gateway"}
