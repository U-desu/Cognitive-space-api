"""Generator Service: Embedding generation."""

from fastapi import APIRouter
from services.shared.models import EmbeddingRequest, EmbeddingResponse
from services.generator import llm_client

router = APIRouter(prefix="/generator/embeddings", tags=["generator-embeddings"])


@router.post("/generate", response_model=EmbeddingResponse)
def generate_embedding(request: EmbeddingRequest):
    vec = llm_client.get_embedding(request.text)
    return EmbeddingResponse(
        embedding=vec,
        model="text-embedding-3-small",
        cached=False,  # Could be enhanced to report cache hit
    )
