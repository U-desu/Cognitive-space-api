import uuid
import copy
from app.models.space import Space, CreateSpaceRequest, Dimension, SpaceMetadata
from app.models.agent import Agent
from app.services import llm_client


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


def create_space(request: CreateSpaceRequest) -> Space:
    space_id = f"space_{uuid.uuid4().hex[:8]}"

    user_context_str = ""
    if request.user_context:
        user_context_str = f"\n用户背景：{request.user_context}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"问题：{request.query}{user_context_str}"},
    ]

    raw = llm_client.chat_completion(messages, json_mode=True)
    data = llm_client.json.loads(raw)
    agents_raw = data.get("agents", [])

    agents = [Agent(**a) for a in agents_raw]

    return Space(
        space_id=space_id,
        query=request.query,
        dimensions={
            "x": Dimension(name="authority", label="权威度", range=[0.0, 1.0]),
            "y": Dimension(name="novelty", label="创新度", range=[0.0, 1.0]),
        },
        agents=agents,
        metadata=SpaceMetadata(
            space_type="general",
            complexity="high" if len(agents) > 4 else "medium",
            estimated_nodes=len(agents),
        ),
    )


def clone_space(query: str, source_space: Space) -> Space:
    """Clone a space with new id, reusing the same agents.

    Used when a similar historical query is detected — avoids duplicate LLM calls.
    """
    new_space_id = f"space_{uuid.uuid4().hex[:8]}"
    # Deep copy agents so mutations on the new space don't affect the original
    cloned_agents = [Agent(**a.model_dump()) for a in source_space.agents]
    return Space(
        space_id=new_space_id,
        query=query,
        dimensions={
            "x": Dimension(name="authority", label="权威度", range=[0.0, 1.0]),
            "y": Dimension(name="novelty", label="创新度", range=[0.0, 1.0]),
        },
        agents=cloned_agents,
        metadata=SpaceMetadata(
            space_type="general",
            complexity="high" if len(cloned_agents) > 4 else "medium",
            estimated_nodes=len(cloned_agents),
        ),
    )
