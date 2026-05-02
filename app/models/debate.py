from typing import Optional
from pydantic import BaseModel


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
    edge_id: str
    participants: list[str]
    transcript: list[Round]
    synthesis: Synthesis
    visualization: dict = {}
