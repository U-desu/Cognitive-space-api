"""Aggregator Service: Preset data API."""

from fastapi import APIRouter
from services.shared.models import HotQuestionPreset
from services.aggregator.static_data import HOT_QUESTIONS

router = APIRouter(prefix="/aggregator/presets", tags=["aggregator-presets"])


@router.get("/hot-questions", response_model=list[HotQuestionPreset])
def get_hot_questions():
    """Get hot question presets for landing page."""
    return [HotQuestionPreset(**q) for q in HOT_QUESTIONS]
