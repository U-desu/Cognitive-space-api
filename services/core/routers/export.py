"""Core Service: Export functionality."""

from fastapi import APIRouter, HTTPException
from services.shared.models import ExportRequest
from services.core import store

router = APIRouter(prefix="/spaces", tags=["export"])


@router.post("/{space_id}/export")
def export_space(space_id: str, payload: ExportRequest):
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    edges = store.get_edges(space_id)
    debates_count = len([e for e in edges if e.debate_recommended])
    traj = store.get_or_create_trajectory(space_id)
    coverage = traj.cognitive_metrics.get("coverage_area", 0.0)

    if payload.format == "shareable_card":
        return {
            "export_id": f"export_{space_id}",
            "share_url": f"https://cognitive.space/s/{space_id}",
            "card_preview": {
                "title": f"我的认知探索：{space.query[:20]}...",
                "summary": f"探索了{len(space.agents)}个视角，参与了{debates_count}场辩论，认知扩展指数 +{int(coverage * 100)}%",
                "space_snapshot": {
                    "agents_count": len(space.agents),
                    "debates_count": debates_count,
                    "coverage_area": coverage,
                },
            },
        }

    result = {
        "space": space.model_dump(),
        "edges": [e.model_dump() for e in edges],
    }
    if payload.include_trajectory:
        result["trajectory"] = traj.model_dump()

    return result
