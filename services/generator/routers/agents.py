"""Generator Service: Agent generation via LangChain structured output."""

from fastapi import APIRouter
from services.shared.models import GenerateAgentsRequest, GenerateAgentsResponse, Agent
from services.generator.llm_chain import build_structured_chain, AgentListOutput

router = APIRouter(prefix="/generator/agents", tags=["generator-agents"])

SYSTEM_PROMPT = """你是一位认知空间设计师。当用户提出一个复杂问题时，你需要生成多个不同视角的专家 Agent。

每个 Agent 应包含以下字段：
- agent_id: 唯一标识符（如 agent_001）
- name: 专家名称（如 "AI创业者"）
- persona: 人物设定（一句话描述）
- stance: 立场，只能是 "pro"（支持）、"con"（反对）或 "neutral"（中立）
- confidence: 自信度 0-1
- domain: 领域标签
- summary: 对该问题的核心观点摘要（一句话）

要求：
1. 生成 3-5 个 Agent，覆盖不同的立场和视角
2. 坐标映射：authority 越高表示在该领域越有权威性；novelty 越高表示观点越新颖/非主流
3. 确保不同 Agent 之间存在真实的观点差异，而非简单的重复
4. 输出必须符合指定的 JSON 格式"""

_agent_chain = build_structured_chain(AgentListOutput, SYSTEM_PROMPT, temperature=0.8)


@router.post("/generate", response_model=GenerateAgentsResponse)
def generate_agents(request: GenerateAgentsRequest):
    user_context_str = ""
    if request.user_context:
        user_context_str = f"\n用户背景：{request.user_context}"

    input_text = f"问题：{request.query}{user_context_str}"

    result = _agent_chain.invoke({"input": input_text})

    agents = [
        Agent(
            agent_id=a.agent_id,
            name=a.name,
            persona=a.persona,
            position={"authority": 0.5, "novelty": 0.5},  # placeholder, frontend assigns
            stance=a.stance,
            confidence=a.confidence,
            domain=a.domain,
            summary=a.summary,
        )
        for a in result.agents
    ]

    return GenerateAgentsResponse(agents=agents, latency_ms=0)
