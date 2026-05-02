import itertools
import math
from app.models.space import Space
from app.models.edge import Edge, DivergenceAxis, SpaceStats
from app.services import llm_client


def _cosine_distance(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    similarity = dot / (norm_a * norm_b)
    # Clamp to [0, 1] to avoid floating point issues
    similarity = max(-1.0, min(1.0, similarity))
    return 1.0 - similarity


def _classify_conflict(score: float) -> str:
    if score > 0.7:
        return "fundamental"
    elif score > 0.3:
        return "partial"
    else:
        return "minor"


def compute_edges(space: Space) -> tuple[list[Edge], SpaceStats]:
    agents = space.agents
    if len(agents) < 2:
        return [], SpaceStats(conflict_density=0.0, consensus_clusters=0, diversity_index=0.0)

    # Pre-compute embeddings
    embeddings = {}
    for agent in agents:
        text = f"{agent.name}: {agent.summary} {agent.persona}"
        embeddings[agent.agent_id] = llm_client.get_embedding(text)

    edges = []
    for a, b in itertools.combinations(agents, 2):
        emb_a = embeddings[a.agent_id]
        emb_b = embeddings[b.agent_id]
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

    # Compute space stats
    if edges:
        conflict_density = sum(e.conflict_score for e in edges) / len(edges)
        fundamental_count = sum(1 for e in edges if e.conflict_type == "fundamental")
        diversity_index = fundamental_count / len(edges)
    else:
        conflict_density = 0.0
        diversity_index = 0.0

    # Simple consensus clustering: count connected components where conflict_score < 0.3
    # For simplicity, just report 1 cluster if any edges exist
    consensus_clusters = 1 if edges else 0

    stats = SpaceStats(
        conflict_density=round(conflict_density, 4),
        consensus_clusters=consensus_clusters,
        diversity_index=round(diversity_index, 4),
    )

    return edges, stats
