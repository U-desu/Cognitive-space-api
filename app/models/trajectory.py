from typing import Any, Optional
from pydantic import BaseModel


class TrajectoryPoint(BaseModel):
    node: str
    timestamp: int
    action: str  # view / expand / debate
    dwell_time: int = 0


class CognitiveMetrics(BaseModel):
    coverage_area: float = 0.0
    depth_score: float = 0.0
    breadth_score: float = 0.0
    conflict_engagement: float = 0.0


class SuggestedNext(BaseModel):
    action: str
    reason: str


class Trajectory(BaseModel):
    trajectory_id: str
    space_id: str
    path: list[TrajectoryPoint]
    cognitive_metrics: dict[str, Any]
    journey_stage: str = "exploration"
    suggested_next: dict[str, Any]
