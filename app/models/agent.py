from enum import Enum
from pydantic import BaseModel, Field


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

    class Config:
        use_enum_values = True
