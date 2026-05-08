"""Core Service: Space CRUD and Agent retrieval."""

from fastapi import APIRouter, HTTPException
from services.shared.models import Space, CreateSpaceRequest
from services.core import store

router = APIRouter(prefix="/spaces", tags=["spaces"])


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
