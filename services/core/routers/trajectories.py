"""Core Service: Trajectory recording and retrieval."""

import time
from fastapi import APIRouter, HTTPException
from services.shared.models import Trajectory, TrajectoryPoint, RecordActionRequest
from services.core import store

router = APIRouter(prefix="/trajectories", tags=["trajectories"])


@router.post("/actions")
def record_action(req: RecordActionRequest):
    traj = store.get_or_create_trajectory(req.space_id)
    point = TrajectoryPoint(
        node=req.node,
        timestamp=int(time.time()),
        action=req.action,
        dwell_time=req.dwell_time,
    )
    traj.path.append(point)
    store.save_trajectory(traj)
    return traj


@router.get("/{space_id}")
def get_trajectory(space_id: str):
    return store.get_or_create_trajectory(space_id)
