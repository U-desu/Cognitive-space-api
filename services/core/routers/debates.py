"""Core Service: Debate storage and retrieval."""

from fastapi import APIRouter, HTTPException
from services.shared.models import Debate
from services.core import store

router = APIRouter(prefix="/debates", tags=["debates"])


@router.post("/ingest")
def ingest_debate(debate: Debate):
    """Ingest a generated debate (called by gateway)."""
    store.save_debate(debate)
    return debate


@router.get("/{debate_id}")
def get_debate(debate_id: str):
    debate = store.get_debate(debate_id)
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    return debate


@router.get("/by-edge/{edge_id}")
def get_debates_by_edge(edge_id: str):
    return store.get_debates_by_edge(edge_id)
