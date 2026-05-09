"""Compute Service: Edge computation API.

Computes conflict edges using real semantic embeddings.
Embedding backend is pluggable (local / openai / keyword) via COMPUTE_EMBED_BACKEND env var.
"""

from fastapi import APIRouter
from services.shared.models import ComputeEdgesRequest, ComputeEdgesResponse, Space
from services.compute.edge_calculator import compute_edges
from services.compute import embedder
import httpx
from services.shared import config

router = APIRouter(prefix="/compute/edges", tags=["compute-edges"])


@router.post("/compute", response_model=ComputeEdgesResponse)
async def compute_edges_endpoint(request: ComputeEdgesRequest):
    """Compute edges for a space.
    
    Fetches space from core service, computes real semantic embeddings locally,
    then runs pure math computation.
    """
    async with httpx.AsyncClient() as client:
        space_resp = await client.get(f"{config.CORE_URL}/spaces/{request.space_id}")
        space_resp.raise_for_status()
        space = Space(**space_resp.json())

    # Compute embeddings locally using the pluggable embedder
    texts = [f"{a.name}: {a.summary} {a.persona}" for a in space.agents]
    embeddings_list = embedder.embed_batch(texts)
    embeddings = {
        agent.agent_id: vec
        for agent, vec in zip(space.agents, embeddings_list)
    }

    edges, stats = compute_edges(space, embeddings)
    return ComputeEdgesResponse(edges=edges, space_stats=stats)
