"""Compute Service: Edge computation API."""

from fastapi import APIRouter
from services.shared.models import ComputeEdgesRequest, ComputeEdgesResponse, Space
from services.compute.edge_calculator import compute_edges
import httpx
from services.shared import config

router = APIRouter(prefix="/compute/edges", tags=["compute-edges"])


@router.post("/compute", response_model=ComputeEdgesResponse)
async def compute_edges_endpoint(request: ComputeEdgesRequest):
    """Compute edges for a space.
    
    Fetches space from core service, embeddings from generator service,
    then runs pure math computation.
    """
    async with httpx.AsyncClient() as client:
        # Fetch space
        space_resp = await client.get(f"{config.CORE_URL}/spaces/{request.space_id}")
        space_resp.raise_for_status()
        space = Space(**space_resp.json())

        # Fetch embeddings for all agents
        embeddings = {}
        for agent in space.agents:
            emb_resp = await client.post(
                f"{config.GENERATOR_URL}/generator/embeddings/generate",
                json={"text": f"{agent.name}: {agent.summary} {agent.persona}"},
            )
            emb_resp.raise_for_status()
            embeddings[agent.agent_id] = emb_resp.json()["embedding"]

    edges, stats = compute_edges(space, embeddings)
    return ComputeEdgesResponse(edges=edges, space_stats=stats)
