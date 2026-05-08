"""LangChain-based LLM generation layer.

Replaces raw OpenAI SDK calls with structured output parsing,
retry logic, and unified prompt management.

Supports: OpenAI, DeepSeek, Kimi (any OpenAI-compatible provider)
"""

import os
from typing import Type, Optional
from pydantic import BaseModel

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import RunnableSerializable

from services.shared import config


def _get_llm(temperature: float = 0.7) -> ChatOpenAI:
    """Create a LangChain ChatOpenAI instance with provider-aware config."""
    return ChatOpenAI(
        model=config.MODEL_NAME,
        api_key=config.API_KEY,
        base_url=config.API_BASE_URL,
        temperature=temperature,
        # Disable streaming for structured output (required by PydanticOutputParser)
        streaming=False,
    )


def build_structured_chain(
    output_model: Type[BaseModel],
    system_prompt: str,
    temperature: float = 0.7,
) -> RunnableSerializable:
    """Build a LangChain chain that enforces structured JSON output.

    Usage:
        chain = build_structured_chain(AgentList, SYSTEM_PROMPT)
        result = chain.invoke({"query": "..."})
    """
    parser = PydanticOutputParser(pydantic_object=output_model)

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt + "\n\n{format_instructions}"),
        ("human", "{input}"),
    ]).partial(format_instructions=parser.get_format_instructions())

    llm = _get_llm(temperature)
    return prompt | llm | parser


# ── Structured Output Models ──

class AgentOutput(BaseModel):
    """Single agent output for structured generation."""
    agent_id: str
    name: str
    persona: str
    stance: str  # pro / con / neutral
    confidence: float
    domain: str
    summary: str


class AgentListOutput(BaseModel):
    """List of agents output."""
    agents: list[AgentOutput]


class TurnOutput(BaseModel):
    """Single turn in a debate."""
    agent: str
    type: str  # argument / rebuttal
    content: str
    evidence: list[str] = []


class RoundOutput(BaseModel):
    """Single round in a debate."""
    round: int
    turns: list[TurnOutput]


class SynthesisOutput(BaseModel):
    """Debate synthesis."""
    core_conflict: str
    resolution_suggestion: str
    agreement_points: list[str]
    divergence_points: list[str]


class DebateOutput(BaseModel):
    """Full debate output."""
    transcript: list[RoundOutput]
    synthesis: SynthesisOutput
