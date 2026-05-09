"""Shared Pydantic models across all services.

Design note: All models are database-agnostic. When migrating to PostgreSQL:
- Core models (Space, Agent, Edge, Debate, Trajectory) → relational tables with FKs
- Generator outputs (Agent content, Debate content, Embedding) → cache layer (Redis)
- Aggregator outputs (ExternalUser, ExternalQuestion) → document store (MongoDB/ES)
"""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, ConfigDict


# ─────────────── Agent ───────────────

class Stance(str, Enum):
    PRO = "pro"
    CON = "con"
    NEUTRAL = "neutral"


class Position(BaseModel):
    authority: float = Field(..., ge=0.0, le=1.0)
    novelty: float = Field(..., ge=0.0, le=1.0)


class Agent(BaseModel):
    agent_id: str
    name: str
    persona: str = ""
    position: Position
    stance: Stance
    confidence: float = Field(0.8, ge=0.0, le=1.0)
    domain: str = ""
    summary: str = ""
    parent_id: Optional[str] = None  # 父 Agent ID，表示由该 Agent 展开生成

    model_config = ConfigDict(use_enum_values=True)


# ─────────────── Space ───────────────

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
    user_id: Optional[str] = None  # null = anonymous space


# ─────────────── Edge ───────────────

class DivergenceAxis(BaseModel):
    axis: str
    a_stance: str
    b_stance: str


class Edge(BaseModel):
    edge_id: str
    source: str
    target: str
    conflict_score: float
    conflict_type: str = "partial"  # fundamental / partial / minor
    shared_ground: list[str] = []
    divergence_axes: list[DivergenceAxis] = []
    debate_recommended: bool = False


class SpaceStats(BaseModel):
    conflict_density: float
    consensus_clusters: int
    diversity_index: float


class ComputeEdgesRequest(BaseModel):
    space_id: str


class ComputeEdgesResponse(BaseModel):
    edges: list[Edge]
    space_stats: SpaceStats


# ─────────────── Debate ───────────────

class Turn(BaseModel):
    agent: str
    type: str  # argument / rebuttal / conclusion
    content: str
    evidence: list[str] = []


class Round(BaseModel):
    round: int
    turns: list[Turn]


class Synthesis(BaseModel):
    core_conflict: str
    resolution_suggestion: str
    agreement_points: list[str] = []
    divergence_points: list[str] = []


class DebateRequest(BaseModel):
    edge_id: str
    format: str = "structured"  # structured / free
    rounds: int = 2
    focus_axes: Optional[list[str]] = None


class Debate(BaseModel):
    debate_id: str
    space_id: str = ""      # populated by gateway after generation
    edge_id: str
    participants: list[str]
    transcript: list[Round]
    synthesis: Synthesis
    visualization: dict = {}


class GenerateDebateRequest(BaseModel):
    space_id: str
    edge_id: str
    agent_a: Agent
    agent_b: Agent
    edge: Edge
    debate_request: DebateRequest


# ─────────────── Trajectory ───────────────

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


class RecordActionRequest(BaseModel):
    space_id: str
    node: str
    action: str
    dwell_time: int = 0


class ComputeMetricsRequest(BaseModel):
    space: Space
    trajectory: Trajectory


# ─────────────── Embedding ───────────────

class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    model: str
    cached: bool = False


# ─────────────── Aggregator (External Data) ───────────────

class ExternalUser(BaseModel):
    name: str
    avatar: str
    title: str
    followers: str
    url: str
    domain: str


class ExternalQuestion(BaseModel):
    title: str
    url: str
    views: str
    domain: str


class HotQuestionPreset(BaseModel):
    icon_type: str  # briefcase / code / heart
    label: str
    text: str
    color: str


class DomainLabel(BaseModel):
    key: str
    label: str


# ─────────────── Generator ───────────────

class GenerateAgentsRequest(BaseModel):
    query: str
    user_context: Optional[dict[str, Any]] = None


class GenerateAgentsResponse(BaseModel):
    agents: list[Agent]
    latency_ms: int = 0


class ExpandAgentRequest(BaseModel):
    """基于已有 Agent 向外发散生成新 Agents 的请求。"""
    parent_agent: Agent                     # 父 Agent 完整信息
    query_hint: str = ""                    # 用户指定的展开方向提示
    num_agents: int = Field(2, ge=1, le=5)  # 生成数量
    user_context: Optional[dict[str, Any]] = None


class ExpandAgentResponse(BaseModel):
    """Agent 展开响应。"""
    parent_agent_id: str
    new_agents: list[Agent]


class AgentExpandPayload(BaseModel):
    """前端调用 Gateway expand 端点时发送的简化请求体。
    Gateway 会自行从 Space 中获取 parent_agent 信息。"""
    query_hint: str = ""
    num_agents: int = Field(2, ge=1, le=5)


# ─────────────── Export ───────────────

class ExportRequest(BaseModel):
    format: str = "json"
    include_trajectory: bool = True
    include_synthesis: bool = True


class ShareableCard(BaseModel):
    title: str
    summary: str
    space_snapshot: dict[str, Any]


class ExportResponse(BaseModel):
    export_id: str
    share_url: str
    card_preview: Optional[ShareableCard] = None
    space: Optional[dict[str, Any]] = None
    edges: Optional[list[dict[str, Any]]] = None
    trajectory: Optional[dict[str, Any]] = None


# ─────────────── User / Auth ───────────────

class AuthProvider(str, Enum):
    GITHUB = "github"
    PASSWORD = "password"


class User(BaseModel):
    user_id: str
    username: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    auth_provider: AuthProvider
    created_at: int = 0

    model_config = ConfigDict(use_enum_values=True)


class UserRegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class UserLoginRequest(BaseModel):
    username: str
    password: str


class OAuthCallbackRequest(BaseModel):
    code: str

