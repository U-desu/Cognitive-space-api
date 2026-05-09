"""Query similarity cache for deduplication.

Stores query embeddings and maps them to spaces.
When a user asks a similar question, we can reuse the historical agents
instead of calling LLM again.
"""

import math
from typing import Dict, Optional
from app.services import llm_client

# query_text -> embedding vector
_query_embeddings: Dict[str, list[float]] = {}

# query_text -> space_id
_query_space_map: Dict[str, str] = {}


SIMILARITY_THRESHOLD = 0.65


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def save_query(query: str, space_id: str) -> None:
    """Compute embedding for query and store the mapping."""
    embedding = llm_client.get_embedding(query)
    _query_embeddings[query] = embedding
    _query_space_map[query] = space_id


def _text_overlap_similarity(a: str, b: str) -> float:
    """Simple character-level overlap similarity as fallback for mock embeddings."""
    a_chars = set(a.strip())
    b_chars = set(b.strip())
    if not a_chars or not b_chars:
        return 0.0
    intersection = len(a_chars & b_chars)
    union = len(a_chars | b_chars)
    return intersection / union if union > 0 else 0.0


def find_similar_space(query: str, threshold: float = SIMILARITY_THRESHOLD) -> Optional[str]:
    """Find a historically similar query and return its space_id.

    Uses embedding cosine similarity first; falls back to text overlap
    when embeddings are mock-based (e.g., DeepSeek without embedding API).

    Returns None if no similar query is found.
    """
    if not _query_embeddings:
        return None

    query_emb = llm_client.get_embedding(query)

    best_similarity = 0.0
    best_space_id = None

    for hist_query, hist_emb in _query_embeddings.items():
        emb_sim = _cosine_similarity(query_emb, hist_emb)
        # When embeddings are mock (deterministic hash), cosine similarity
        # is not semantic. Use text overlap as the primary signal in that case.
        text_sim = _text_overlap_similarity(query, hist_query)
        # If embedding similarity is very low (<0.5), rely more on text overlap
        sim = max(emb_sim, text_sim)
        if sim > best_similarity:
            best_similarity = sim
            best_space_id = _query_space_map.get(hist_query)

    if best_similarity >= threshold:
        return best_space_id
    return None


def compute_similarity(query_a: str, query_b: str) -> float:
    """Compute cosine similarity between two queries."""
    emb_a = llm_client.get_embedding(query_a)
    emb_b = llm_client.get_embedding(query_b)
    return _cosine_similarity(emb_a, emb_b)
