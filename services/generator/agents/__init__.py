"""Multi-Agent Debate Engine.

Each debate role is an independent LLM Agent with its own persona,
memory, and prompt. Turns are generated sequentially and streamed
via SSE as they become available.
"""

from .debate_state import DebateState
from .debate_agent import DebateAgent
from .moderator_agent import ModeratorAgent

__all__ = ["DebateState", "DebateAgent", "ModeratorAgent"]
