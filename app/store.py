"""In-memory store for Cognitive Spaces."""

from typing import Dict, Optional
from app.models.space import Space
from app.models.edge import Edge
from app.models.debate import Debate
from app.models.trajectory import Trajectory

# In-memory databases
_spaces: Dict[str, Space] = {}
_edges: Dict[str, list[Edge]] = {}
_debates: Dict[str, Debate] = {}
_trajectories: Dict[str, Trajectory] = {}


def save_space(space: Space) -> None:
    _spaces[space.space_id] = space


def get_space(space_id: str) -> Optional[Space]:
    return _spaces.get(space_id)


def save_edges(space_id: str, edges: list[Edge]) -> None:
    _edges[space_id] = edges


def get_edges(space_id: str) -> list[Edge]:
    return _edges.get(space_id, [])


def get_edge(space_id: str, edge_id: str) -> Optional[Edge]:
    for edge in get_edges(space_id):
        if edge.edge_id == edge_id:
            return edge
    return None


def save_debate(debate: Debate) -> None:
    _debates[debate.debate_id] = debate


def get_debate(debate_id: str) -> Optional[Debate]:
    return _debates.get(debate_id)


def get_or_create_trajectory(space_id: str) -> Trajectory:
    if space_id not in _trajectories:
        _trajectories[space_id] = Trajectory(
            trajectory_id=f"traj_{space_id}",
            space_id=space_id,
            path=[],
            cognitive_metrics={},
            journey_stage="exploration",
            suggested_next={},
        )
    return _trajectories[space_id]


def save_trajectory(trajectory: Trajectory) -> None:
    _trajectories[trajectory.space_id] = trajectory
