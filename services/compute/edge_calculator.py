"""Edge Calculator - Pure mathematical computation.

No LLM involved. Computes conflict edges from agent embeddings.

Input: list of Agents with embeddings
Output: list of Edges + SpaceStats

Stateless: can be horizontally scaled without shared storage.
"""

import itertools
import math
from services.shared.models import Space, Edge, DivergenceAxis, SpaceStats


def _cosine_distance(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    similarity = dot / (norm_a * norm_b)
    similarity = max(-1.0, min(1.0, similarity))
    return 1.0 - similarity


def _classify_conflict(score: float) -> str:
    if score > 0.7:
        return "fundamental"
    elif score > 0.3:
        return "partial"
    else:
        return "minor"


def compute_edges(space: Space, embeddings: dict[str, list[float]]) -> tuple[list[Edge], SpaceStats]:
    """Compute conflict edges between all agent pairs.
    
    Args:
        space: The cognitive space with agents
        embeddings: dict mapping agent_id -> embedding vector
    
    Returns:
        (edges, space_stats)
    """
    agents = space.agents
    if len(agents) < 2:
        return [], SpaceStats(conflict_density=0.0, consensus_clusters=0, diversity_index=0.0)

    edges = []
    for a, b in itertools.combinations(agents, 2):
        emb_a = embeddings.get(a.agent_id)
        emb_b = embeddings.get(b.agent_id)
        if emb_a is None or emb_b is None:
            continue
        score = _cosine_distance(emb_a, emb_b)
        ctype = _classify_conflict(score)

        edge = Edge(
            edge_id=f"edge_{a.agent_id}_{b.agent_id}",
            source=a.agent_id,
            target=b.agent_id,
            conflict_score=round(score, 4),
            conflict_type=ctype,
            shared_ground=[],
            divergence_axes=[],
            debate_recommended=ctype == "fundamental",
        )
        edges.append(edge)

    if edges:
        conflict_density = sum(e.conflict_score for e in edges) / len(edges)
        fundamental_count = sum(1 for e in edges if e.conflict_type == "fundamental")
        diversity_index = fundamental_count / len(edges)
    else:
        conflict_density = 0.0
        diversity_index = 0.0

    consensus_clusters = 1 if edges else 0

    stats = SpaceStats(
        conflict_density=round(conflict_density, 4),
        consensus_clusters=consensus_clusters,
        diversity_index=round(diversity_index, 4),
    )

    return edges, stats
