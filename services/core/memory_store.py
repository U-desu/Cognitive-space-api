"""In-memory store for Core Service.

This is the default storage backend when USE_DB=false.
Zero dependencies, zero configuration.
"""

from typing import Dict, Optional, TYPE_CHECKING
from services.shared.models import Space, Edge, Debate, Trajectory, User

if TYPE_CHECKING:
    from services.shared.models import Agent

_spaces: Dict[str, Space] = {}
_edges: Dict[str, list[Edge]] = {}
_debates: Dict[str, Debate] = {}
_trajectories: Dict[str, Trajectory] = {}

_users: Dict[str, User] = {}
_passwords: Dict[str, str] = {}
_oauth_accounts: Dict[str, str] = {}
_user_spaces: Dict[str, list[str]] = {}


# ── Space ──

def save_space(space: Space) -> None:
    _spaces[space.space_id] = space


def get_space(space_id: str) -> Optional[Space]:
    return _spaces.get(space_id)


def get_user_spaces(user_id: str) -> list[str]:
    """Get space IDs linked to a user."""
    return _user_spaces.get(user_id, [])


def list_spaces() -> list[Space]:
    return list(_spaces.values())


def find_similar_space(owner_id: str, query_embedding: list[float], threshold: float = 0.85) -> Optional[Space]:
    """Find the most similar space for the given owner."""
    import math
    best_space = None
    best_score = 0.0
    for space in _spaces.values():
        if space.user_id != owner_id and space.guest_id != owner_id:
            continue
        if not space.query_embedding:
            continue
        # cosine similarity
        dot = sum(a * b for a, b in zip(query_embedding, space.query_embedding))
        norm_a = math.sqrt(sum(x * x for x in query_embedding))
        norm_b = math.sqrt(sum(x * x for x in space.query_embedding))
        if norm_a == 0 or norm_b == 0:
            continue
        score = dot / (norm_a * norm_b)
        if score > best_score:
            best_score = score
            best_space = space
    if best_space and best_score >= threshold:
        return best_space
    return None


def list_space_history(owner_id: str) -> list[Space]:
    """List all spaces for the given owner (user or guest)."""
    spaces = [
        s for s in _spaces.values()
        if s.user_id == owner_id or s.guest_id == owner_id
    ]
    # Sort by creation time (space_id prefix has no timestamp, use arbitrary stable order)
    return spaces


def delete_space(space_id: str) -> bool:
    """Delete a space and all its related data."""
    if space_id not in _spaces:
        return False
    del _spaces[space_id]
    _edges.pop(space_id, None)
    _trajectories.pop(space_id, None)
    for debate_id in list(_debates.keys()):
        if _debates[debate_id].space_id == space_id:
            del _debates[debate_id]
    return True


def add_agents_to_space(space_id: str, agents: list["Agent"]) -> None:
    """Append new agents to an existing space (used by expand)."""
    space = _spaces.get(space_id)
    if not space:
        return
    existing_ids = {a.agent_id for a in space.agents}
    for agent in agents:
        if agent.agent_id not in existing_ids:
            space.agents.append(agent)


# ── Edge ──

def save_edges(space_id: str, edges: list[Edge]) -> None:
    _edges[space_id] = edges


def get_edges(space_id: str) -> list[Edge]:
    return _edges.get(space_id, [])


def get_edge(space_id: str, edge_id: str) -> Optional[Edge]:
    for edge in get_edges(space_id):
        if edge.edge_id == edge_id:
            return edge
    return None


def update_edge(space_id: str, edge: Edge) -> None:
    edges = _edges.get(space_id, [])
    for i, e in enumerate(edges):
        if e.edge_id == edge.edge_id:
            edges[i] = edge
            break


# ── Debate ──

def save_debate(debate: Debate) -> None:
    _debates[debate.debate_id] = debate


def get_debate(debate_id: str) -> Optional[Debate]:
    return _debates.get(debate_id)


def get_debates_by_edge(edge_id: str) -> list[Debate]:
    return [d for d in _debates.values() if d.edge_id == edge_id]


# ── Trajectory ──

def get_or_create_trajectory(space_id: str) -> Trajectory:
    if space_id not in _trajectories:
        _trajectories[space_id] = Trajectory(
            trajectory_id=f"traj_{space_id}",
            space_id=space_id,
            path=[],
            cognitive_metrics={
                "coverage_area": 0.18,
                "depth_score": 0.12,
                "breadth_score": 0.25,
                "conflict_engagement": 0.10,
            },
            journey_stage="exploration",
            suggested_next={"action": "view_agent", "reason": "开始探索不同专家视角"},
        )
    return _trajectories[space_id]


def save_trajectory(trajectory: Trajectory) -> None:
    _trajectories[trajectory.space_id] = trajectory


# ── User / Auth (kept for backward compat, Gateway uses its own store) ──

