from pydantic import BaseModel


class DivergenceAxis(BaseModel):
    axis: str
    a_stance: str
    b_stance: str


class Edge(BaseModel):
    edge_id: str
    source: str
    target: str
    conflict_score: float
    conflict_type: str = "partial"  # fundamental / partial / minor
    shared_ground: list[str] = []
    divergence_axes: list[DivergenceAxis] = []
    debate_recommended: bool = False


class SpaceStats(BaseModel):
    conflict_density: float
    consensus_clusters: int
    diversity_index: float
