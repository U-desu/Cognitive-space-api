"""Core Service: Space CRUD and Agent retrieval."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.shared.models import Space, CreateSpaceRequest, Agent
from services.core import store

router = APIRouter(prefix="/spaces", tags=["spaces"])


class SimilaritySearchRequest(BaseModel):
    owner_id: str
    query_embedding: list[float]
    threshold: float = 0.85


class SimilaritySearchResponse(BaseModel):
    matched: bool
    space: Optional[Space] = None
    similarity: float = 0.0


@router.post("", response_model=Space)
def create_space(request: CreateSpaceRequest):
    """Create a space with pre-generated agents (from generator service via gateway orchestration).
    
    In the current flow, the gateway calls generator first, then posts the full Space here.
    """
    # This endpoint accepts a fully-formed Space object (after generation)
    # For direct core-service usage, space is expected to be injected by gateway
    raise HTTPException(status_code=400, detail="Use gateway /spaces endpoint for full creation flow")


@router.post("/ingest", response_model=Space)
def ingest_space(space: Space):
    """Ingest a fully-constructed space (called by gateway after agent generation)."""
    store.save_space(space)
    return space


@router.get("/{space_id}", response_model=Space)
def get_space(space_id: str):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    return space


@router.get("", response_model=list[Space])
def list_spaces():
    return store.list_spaces()


@router.get("/my/{user_id}", response_model=list[Space])
def get_my_spaces(user_id: str):
    """Get spaces associated with a user."""
    space_ids = store.get_user_spaces(user_id)
    return [store.get_space(sid) for sid in space_ids if store.get_space(sid)]


@router.post("/similarity-search", response_model=SimilaritySearchResponse)
def similarity_search(request: SimilaritySearchRequest):
    """Search for a similar space owned by the given owner."""
    import math
    space = store.find_similar_space(request.owner_id, request.query_embedding, request.threshold)
    if space:
        # Compute actual similarity for response
        dot = sum(a * b for a, b in zip(request.query_embedding, space.query_embedding or []))
        norm_a = math.sqrt(sum(x * x for x in request.query_embedding))
        norm_b = math.sqrt(sum(x * x for x in (space.query_embedding or [])))
        score = dot / (norm_a * norm_b) if norm_a > 0 and norm_b > 0 else 0.0
        return SimilaritySearchResponse(matched=True, space=space, similarity=round(score, 4))
    return SimilaritySearchResponse(matched=False)


@router.get("/history/{owner_id}", response_model=list[Space])
def get_space_history(owner_id: str):
    """Get all spaces for a user, ordered by creation time desc."""
    return store.list_space_history(owner_id)


@router.post("/{space_id}/agents", response_model=Space)
def add_agents(space_id: str, agents: list[Agent]):
    """向已有 Space 追加 Agent（由 gateway 调用）。"""
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    # 去重：避免重复添加同 agent_id
    existing_ids = {a.agent_id for a in space.agents}
    new_agents = [a for a in agents if a.agent_id not in existing_ids]
    space.agents.extend(new_agents)
    store.save_space(space)
    # 如果启用 DB，同时写入 agents 表
    store.add_agents_to_space(space_id, new_agents)
    return space


@router.delete("/{space_id}")
def delete_space(space_id: str):
    """Delete a space and all its data."""
    deleted = store.delete_space(space_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Space not found")
    return {"message": "Space deleted", "space_id": space_id}
