"""Compute Service: Text embedding API.

Exposes the pluggable embedder as a standalone endpoint for other services.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from services.compute import embedder

router = APIRouter(prefix="/compute/embed", tags=["compute-embed"])


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]
    backend: str


@router.post("", response_model=EmbedResponse)
def embed_endpoint(request: EmbedRequest):
    """Compute embedding vector for the given text.

    Backend is selected via COMPUTE_EMBED_BACKEND env var:
    - "local": sentence-transformers
    - "openai": OpenAI API
    - "keyword": domain-keyword vectors (default)
    """
    vec = embedder.embed(request.text)
    from services.shared import config
    backend = config.COMPUTE_EMBED_BACKEND.lower()
    return EmbedResponse(embedding=vec, backend=backend)
