"""Aggregator Service: Zhihu data API.

Provides mock external data previously stored in frontend.
Future: replace with real Zhihu API calls + cache.
"""

from fastapi import APIRouter, Query
from services.shared.models import ExternalUser, ExternalQuestion
from services.aggregator.mock_data import ZHIHU_USERS, ZHIHU_QUESTIONS, DOMAIN_LABELS

router = APIRouter(prefix="/aggregator/zhihu", tags=["aggregator-zhihu"])


def _match_query_preset(query: str) -> str:
    q = query.strip()
    if "程序" in q or "取代" in q or "失业" in q or "替代" in q:
        return "程序员取代"
    if "管理" in q or "转管理" in q or "深耕技术" in q or "技术还是管理" in q:
        return "技术管理"
    return "大厂创业"


@router.get("/users", response_model=list[ExternalUser])
def get_zhihu_users(domain: str = Query(..., description="Agent domain")):
    """Get Zhihu users for a given domain."""
    users = ZHIHU_USERS.get(domain, ZHIHU_USERS.get("startup", []))
    return [ExternalUser(**u, domain=domain) for u in users]


@router.get("/questions", response_model=list[ExternalQuestion])
def get_zhihu_questions(query: str = Query(..., description="Space query")):
    """Get related Zhihu questions for a query."""
    preset = _match_query_preset(query)
    questions = ZHIHU_QUESTIONS.get(preset, [])
    return [ExternalQuestion(**q, domain=preset) for q in questions]


@router.get("/domain-labels")
def get_domain_labels():
    """Get all domain label mappings."""
    return DOMAIN_LABELS
