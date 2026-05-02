import time
from typing import Any
from shapely.geometry import MultiPoint
from app.models.space import Space
from app.models.trajectory import Trajectory, TrajectoryPoint, CognitiveMetrics, SuggestedNext
from app import store


def record_action(
    space_id: str,
    node: str,
    action: str,
    dwell_time: int = 0,
) -> Trajectory:
    traj = store.get_or_create_trajectory(space_id)
    point = TrajectoryPoint(
        node=node,
        timestamp=int(time.time()),
        action=action,
        dwell_time=dwell_time,
    )
    traj.path.append(point)
    store.save_trajectory(traj)
    return traj


def _get_visited_positions(space: Space, trajectory: Trajectory) -> list[tuple[float, float]]:
    """Extract (authority, novelty) coordinates from visited agents."""
    agent_map = {a.agent_id: a for a in space.agents}
    positions = []
    seen = set()
    for point in trajectory.path:
        if point.node in agent_map and point.node not in seen:
            seen.add(point.node)
            pos = agent_map[point.node].position
            positions.append((pos.authority, pos.novelty))
    return positions


def _compute_coverage_area(positions: list[tuple[float, float]]) -> float:
    if len(positions) < 3:
        return 0.0
    try:
        hull = MultiPoint(positions).convex_hull
        return round(hull.area, 4)
    except Exception:
        return 0.0


def _compute_depth_score(trajectory: Trajectory) -> float:
    # Based on debate participation and dwell time
    debate_count = sum(1 for p in trajectory.path if p.action == "debate")
    total_dwell = sum(p.dwell_time for p in trajectory.path)
    # Normalize: assume max 3 debates and 180s total dwell
    score = min(1.0, (debate_count * 0.3 + total_dwell / 300))
    return round(score, 4)


def _compute_breadth_score(space: Space, trajectory: Trajectory) -> float:
    visited_agents = set(p.node for p in trajectory.path if p.node.startswith("agent_"))
    if not space.agents:
        return 0.0
    return round(len(visited_agents) / len(space.agents), 4)


def _compute_conflict_engagement(trajectory: Trajectory) -> float:
    if not trajectory.path:
        return 0.0
    debate_actions = sum(1 for p in trajectory.path if p.action == "debate")
    return round(min(1.0, debate_actions / max(1, len(trajectory.path) / 2)), 4)


def _determine_stage(trajectory: Trajectory) -> str:
    actions = [p.action for p in trajectory.path]
    if "debate" in actions:
        return "conflict_resolution"
    if "expand" in actions:
        return "conflict_discovery"
    if actions.count("view") >= 2:
        return "perspective_gathering"
    return "exploration"


def _suggest_next(trajectory: Trajectory, space: Space) -> dict[str, Any]:
    stage = _determine_stage(trajectory)
    suggestions = {
        "exploration": {
            "action": "view_agent",
            "reason": "开始探索不同专家视角",
        },
        "perspective_gathering": {
            "action": "view_agent",
            "reason": "继续收集更多视角",
        },
        "conflict_discovery": {
            "action": "view_edge",
            "reason": "发现了观点差异，查看冲突边",
        },
        "conflict_resolution": {
            "action": "view_synthesis",
            "reason": "你已经看过冲突双方，建议查看共识总结",
        },
    }
    return suggestions.get(stage, {"action": "explore", "reason": "继续探索"})


def compute_metrics(space: Space, trajectory: Trajectory) -> CognitiveMetrics:
    positions = _get_visited_positions(space, trajectory)
    coverage = _compute_coverage_area(positions)
    depth = _compute_depth_score(trajectory)
    breadth = _compute_breadth_score(space, trajectory)
    engagement = _compute_conflict_engagement(trajectory)

    metrics = CognitiveMetrics(
        coverage_area=coverage,
        depth_score=depth,
        breadth_score=breadth,
        conflict_engagement=engagement,
    )

    trajectory.cognitive_metrics = metrics.model_dump()
    trajectory.journey_stage = _determine_stage(trajectory)
    trajectory.suggested_next = _suggest_next(trajectory, space)
    store.save_trajectory(trajectory)

    return metrics
