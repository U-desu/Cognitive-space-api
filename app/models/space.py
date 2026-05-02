from typing import Any, Optional
from pydantic import BaseModel
from app.models.agent import Agent


class Dimension(BaseModel):
    name: str
    label: str
    range: list[float]


class CreateSpaceRequest(BaseModel):
    query: str
    user_context: Optional[dict[str, Any]] = None


class SpaceMetadata(BaseModel):
    space_type: str = "general"
    complexity: str = "medium"
    estimated_nodes: int = 3


class Space(BaseModel):
    space_id: str
    query: str
    dimensions: dict[str, Dimension]
    agents: list[Agent]
    metadata: SpaceMetadata
