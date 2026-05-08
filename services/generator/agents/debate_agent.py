"""DebateAgent: an independent LLM agent representing a single debate role."""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from services.shared import config
from services.shared.models import Agent, Turn
from services.generator.agents.debate_state import DebateState


SYSTEM_PROMPT_TEMPLATE = """你是一位{stance}立场的专家，名叫{name}。

人物设定：{persona}
核心观点：{summary}

辩论规则：
1. 你的发言必须基于你的立场和人物设定，保持角色一致性
2. 内容要具体、有深度，引用具体案例或数据会更有说服力
3. 避免空洞的泛泛而谈，每句话都应该推进论证
4. 直接输出你的发言内容，不要加任何前缀（如"我说："、"作为XXX："等）
5. 发言长度控制在 150-300 字之间"""


class DebateAgent:
    """Each debate participant is an independent LLM agent.

    Has its own:
    - ChatOpenAI instance
    - System Prompt (injected with persona/stance/summary)
    - LangChain chain (prompt → llm → str_output_parser)
    """

    def __init__(self, profile: Agent, temperature: float = 0.7):
        self.profile = profile

        self.llm = ChatOpenAI(
            model=config.MODEL_NAME,
            api_key=config.API_KEY,
            base_url=config.API_BASE_URL,
            temperature=temperature,
            streaming=False,
        )

        self.prompt = ChatPromptTemplate.from_messages([
            (
                "system",
                SYSTEM_PROMPT_TEMPLATE,
            ),
            ("human", "{context}"),
        ])

        self.chain = self.prompt | self.llm | StrOutputParser()

    def invoke(self, state: DebateState) -> Turn:
        """Generate a single turn based on current debate state.

        Returns a Turn with:
        - agent: this agent's agent_id
        - type: argument or rebuttal (determined by state)
        - content: generated text
        - evidence: empty list (placeholder for future enhancement)
        """
        context = state.build_prompt_for(self.profile)

        # Inject persona variables into system prompt
        result = self.chain.invoke({
            "context": context,
            "name": self.profile.name,
            "persona": self.profile.persona,
            "stance": self.profile.stance,
            "summary": self.profile.summary,
        })

        # Clean up the output
        content = result.strip()
        # Remove common prefixes that LLM sometimes adds
        prefixes = [
            f"{self.profile.name}：", f"{self.profile.name}:",
            "我说：", "我说:",
            "观点：", "观点:",
            "发言：", "发言:",
        ]
        for p in prefixes:
            if content.startswith(p):
                content = content[len(p):].strip()

        return Turn(
            agent=self.profile.agent_id,
            type=state.next_turn_type(),
            content=content,
            evidence=[],
        )
