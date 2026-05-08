"""Compute Service: Metrics computation API."""

from fastapi import APIRouter
from services.shared.models import Space, Trajectory, ComputeMetricsRequest
from services.compute.metrics_calculator import compute_metrics

router = APIRouter(prefix="/compute/metrics", tags=["compute-metrics"])


@router.post("/compute")
def compute_metrics_endpoint(request: ComputeMetricsRequest):
    """Compute cognitive metrics from space + trajectory.
    
    Stateless computation — no external service calls needed.
    """
    metrics = compute_metrics(request.space, request.trajectory)
    return {
        "metrics": metrics.model_dump(),
        "journey_stage": request.trajectory.journey_stage,
        "suggested_next": request.trajectory.suggested_next,
    }
