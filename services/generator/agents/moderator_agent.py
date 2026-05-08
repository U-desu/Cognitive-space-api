"""ModeratorAgent: generates synthesis from completed debate turns."""

import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

from services.shared import config
from services.generator.agents.debate_state import DebateState


class SynthesisOutput(BaseModel):
    """Structured synthesis output."""
    core_conflict: str = Field(description="核心冲突的本质（一句话）")
    resolution_suggestion: str = Field(description="给提问者的具体建议")
    agreement_points: list[str] = Field(default_factory=list, description="双方共识点列表")
    divergence_points: list[str] = Field(default_factory=list, description="双方分歧点列表")


class ModeratorAgent:
    """Generates synthesis after all debate turns are complete.

    Uses PydanticOutputParser for reliable structured JSON output.
    """

    def __init__(self, temperature: float = 0.5):
        self.llm = ChatOpenAI(
            model=config.MODEL_NAME,
            api_key=config.API_KEY,
            base_url=config.API_BASE_URL,
            temperature=temperature,
            streaming=False,
        )

        self.parser = PydanticOutputParser(pydantic_object=SynthesisOutput)

        self.prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                "你是一位认知合成专家。请基于辩论记录，提炼核心冲突、给出建议、总结共识与分歧。\n\n"
                "{format_instructions}",
            ),
            ("human", "{context}"),
        ]).partial(format_instructions=self.parser.get_format_instructions())

        self.chain = self.prompt | self.llm | self.parser

    def invoke(self, state: DebateState) -> SynthesisOutput:
        """Generate synthesis from the full debate state."""
        context = state.build_moderator_prompt()
        return self.chain.invoke({"context": context})
