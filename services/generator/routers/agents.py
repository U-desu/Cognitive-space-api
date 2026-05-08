"""Generator Service: Agent generation."""

from fastapi import APIRouter
from services.shared.models import GenerateAgentsRequest, GenerateAgentsResponse, Agent
from services.generator import llm_client
import json

router = APIRouter(prefix="/generator/agents", tags=["generator-agents"])

SYSTEM_PROMPT = """你是一位认知空间设计师。当用户提出一个复杂问题时，你需要生成多个不同视角的专家 Agent。

每个 Agent 应包含以下字段：
- agent_id: 唯一标识符（如 agent_001）
- name: 专家名称（如 "AI创业者"）
- persona: 人物设定（一句话描述）
- position: 包含 authority（权威度 0-1）和 novelty（创新度 0-1）
- stance: 立场，只能是 "pro"（支持）、"con"（反对）或 "neutral"（中立）
- confidence: 自信度 0-1
- domain: 领域标签
- summary: 对该问题的核心观点摘要（一句话）

要求：
1. 生成 3-5 个 Agent，覆盖不同的立场和视角
2. 坐标映射：authority 越高表示在该领域越有权威性；novelty 越高表示观点越新颖/非主流
3. 确保不同 Agent 之间存在真实的观点差异，而非简单的重复

请以 JSON 数组形式返回结果，字段名为 agents。"""


@router.post("/generate", response_model=GenerateAgentsResponse)
def generate_agents(request: GenerateAgentsRequest):
    user_context_str = ""
    if request.user_context:
        user_context_str = f"\n用户背景：{request.user_context}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"问题：{request.query}{user_context_str}"},
    ]

    raw = llm_client.chat_completion(messages, json_mode=True)
    data = json.loads(raw)
    agents_raw = data.get("agents", [])
    agents = [Agent(**a) for a in agents_raw]

    return GenerateAgentsResponse(agents=agents, latency_ms=0)
