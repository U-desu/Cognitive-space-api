from fastapi import APIRouter, HTTPException
from typing import Any
from app.models.space import CreateSpaceRequest, Space
from app.models.edge import Edge, SpaceStats
from app.models.debate import Debate, DebateRequest
from app.models.trajectory import Trajectory, TrajectoryPoint
from app.services import space_service, edge_service, debate_service, trajectory_service, query_cache
from app import store

router = APIRouter(prefix="/spaces", tags=["spaces"])


@router.post("", response_model=Space)
def create_space(request: CreateSpaceRequest):
    # Check for similar historical query to avoid duplicate LLM calls
    similar_space_id = query_cache.find_similar_space(request.query)
    if similar_space_id:
        hist_space = store.get_space(similar_space_id)
        if hist_space:
            # Reuse agents from historical space with a new space_id
            new_space = space_service.clone_space(request.query, hist_space)
            store.save_space(new_space)
            query_cache.save_query(request.query, new_space.space_id)
            return new_space

    # No similar query found — generate fresh agents via LLM
    space = space_service.create_space(request)
    store.save_space(space)
    query_cache.save_query(request.query, space.space_id)
    return space


@router.get("/{space_id}", response_model=Space)
def get_space(space_id: str):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    return space


@router.post("/{space_id}/perspectives")
def generate_perspectives(space_id: str, payload: dict):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # For now, return existing agents with their summaries
    # In a full implementation, this would call LLM to expand each perspective
    agent_ids = payload.get("agent_ids", [])
    depth = payload.get("context", {}).get("depth", "detailed")

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


@router.post("/{space_id}/edges")
def compute_edges(space_id: str):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    edges, stats = edge_service.compute_edges(space)
    store.save_edges(space_id, edges)
    return {"edges": [e.model_dump() for e in edges], "space_stats": stats.model_dump()}


@router.post("/{space_id}/debates")
def create_debate(space_id: str, request: DebateRequest):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    edge = store.get_edge(space_id, request.edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")

    debate = debate_service.run_debate(edge, space.agents, request)
    store.save_debate(debate)

    # Record trajectory
    trajectory_service.record_action(space_id, request.edge_id, "debate", dwell_time=45)
    traj = store.get_or_create_trajectory(space_id)
    trajectory_service.compute_metrics(space, traj)

    return debate


@router.get("/{space_id}/trajectory")
def get_trajectory(space_id: str):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    traj = store.get_or_create_trajectory(space_id)
    trajectory_service.compute_metrics(space, traj)
    return traj
