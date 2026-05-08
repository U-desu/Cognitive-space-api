"""Core Service: Edge storage and retrieval."""

from fastapi import APIRouter, HTTPException
from services.shared.models import Edge
from services.core import store

router = APIRouter(prefix="/spaces", tags=["edges"])


@router.post("/{space_id}/edges")
def save_edges(space_id: str, payload: dict):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    edges_raw = payload.get("edges", [])
    edges = [Edge(**e) for e in edges_raw]
    store.save_edges(space_id, edges)
    return {"saved": len(edges)}


@router.get("/{space_id}/edges")
def get_edges(space_id: str):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    return store.get_edges(space_id)


@router.get("/{space_id}/edges/{edge_id}")
def get_edge(space_id: str, edge_id: str):
    edge = store.get_edge(space_id, edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge
