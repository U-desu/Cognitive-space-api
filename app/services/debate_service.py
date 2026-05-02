import uuid
from app.models.edge import Edge
from app.models.agent import Agent
from app.models.debate import Debate, DebateRequest, Round, Turn, Synthesis
from app.services import llm_client


SYSTEM_PROMPT = """你是一位结构化辩论主持人。请根据两位专家的分歧，组织一场高质量的对抗性辩论。

辩论要求：
1. 围绕真实的分歧轴进行对抗（如时机判断、风险偏好等）
2. 每一轮中，双方依次发言，类型包括 argument（立论）、rebuttal（反驳）
3. 辩论结束后，生成 synthesis（认知合成），包括：
   - core_conflict: 核心冲突的本质
   - resolution_suggestion: 对用户的建议
   - agreement_points: 双方共识点列表
   - divergence_points: 双方分歧点列表

输出格式必须为 JSON，包含：
- transcript: 数组，每个元素包含 round（轮次编号）和 turns（发言列表）
- synthesis: 对象

注意：辩论内容要具体、有深度，避免空洞的泛泛而谈。"""


def _build_prompt(agent_a: Agent, agent_b: Agent, edge: Edge, request: DebateRequest) -> str:
    focus = ""
    if request.focus_axes:
        focus = f"\n请特别围绕以下分歧轴展开辩论：{', '.join(request.focus_axes)}"

    return f"""专家 A：{agent_a.name}（立场：{agent_a.stance}）
观点摘要：{agent_a.summary}
人物设定：{agent_a.persona}

专家 B：{agent_b.name}（立场：{agent_b.stance}）
观点摘要：{agent_b.summary}
人物设定：{agent_b.persona}

冲突分数：{edge.conflict_score}
{focus}

请组织 {request.rounds} 轮辩论。"""


def run_debate(
    edge: Edge,
    agents: list[Agent],
    request: DebateRequest,
) -> Debate:
    agent_map = {a.agent_id: a for a in agents}
    agent_a = agent_map[edge.source]
    agent_b = agent_map[edge.target]

    prompt = _build_prompt(agent_a, agent_b, edge, request)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    raw = llm_client.chat_completion(messages, json_mode=True)
    data = llm_client.json.loads(raw)

    transcript_raw = data.get("transcript", [])
    synthesis_raw = data.get("synthesis", {})

    rounds = []
    for r in transcript_raw:
        turns = [Turn(**t) for t in r.get("turns", [])]
        rounds.append(Round(round=r.get("round", 0), turns=turns))

    synthesis = Synthesis(**synthesis_raw)

    # Update edge with shared/divergence info
    edge.shared_ground = synthesis.agreement_points
    edge.divergence_axes = [
        {"axis": d, "a_stance": "", "b_stance": ""}
        for d in synthesis.divergence_points
    ]

    return Debate(
        debate_id=f"debate_{uuid.uuid4().hex[:8]}",
        edge_id=edge.edge_id,
        participants=[agent_a.agent_id, agent_b.agent_id],
        transcript=rounds,
        synthesis=synthesis,
        visualization={},
    )
