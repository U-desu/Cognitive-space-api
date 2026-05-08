"""Generator Service: Debate generation via LangChain structured output."""

from fastapi import APIRouter
from services.shared.models import (
    Debate, DebateRequest, Round, Turn, Synthesis,
    GenerateDebateRequest,
)
from services.generator.llm_chain import build_structured_chain, DebateOutput
import uuid

router = APIRouter(prefix="/generator/debates", tags=["generator-debates"])

SYSTEM_PROMPT = """你是一位结构化辩论主持人。请根据两位专家的分歧，组织一场高质量的对抗性辩论。

辩论要求：
1. 围绕真实的分歧轴进行对抗（如时机判断、风险偏好等）
2. 每一轮中，双方依次发言，类型包括 argument（立论）、rebuttal（反驳）
3. 辩论结束后，生成 synthesis（认知合成），包括：
   - core_conflict: 核心冲突的本质
   - resolution_suggestion: 对用户的建议
   - agreement_points: 双方共识点列表
   - divergence_points: 双方分歧点列表

注意：
- 辩论内容要具体、有深度，避免空洞的泛泛而谈
- 输出必须符合指定的 JSON 格式
- 每个 turn 的 agent 字段必须是传入的 agent_id（如 agent_001），不要用 speaker 等其他字段名"""

_debate_chain = build_structured_chain(DebateOutput, SYSTEM_PROMPT, temperature=0.7)


def _build_input(agent_a, agent_b, edge, request: DebateRequest) -> str:
    focus = ""
    if request.focus_axes:
        focus = f"\n请特别围绕以下分歧轴展开辩论：{', '.join(request.focus_axes)}"

    return f"""[AGENTS:{agent_a.agent_id},{agent_b.agent_id}]
专家 A：{agent_a.name}（立场：{agent_a.stance}）
观点摘要：{agent_a.summary}
人物设定：{agent_a.persona}

专家 B：{agent_b.name}（立场：{agent_b.stance}）
观点摘要：{agent_b.summary}
人物设定：{agent_b.persona}

冲突分数：{edge.conflict_score}
{focus}

请组织 {request.rounds} 轮辩论。"""


@router.post("/generate", response_model=Debate)
def generate_debate(request: GenerateDebateRequest):
    agent_a = request.agent_a
    agent_b = request.agent_b
    edge = request.edge
    debate_request = request.debate_request

    input_text = _build_input(agent_a, agent_b, edge, debate_request)

    result = _debate_chain.invoke({"input": input_text})

    transcript = [
        Round(
            round=r.round,
            turns=[
                Turn(agent=t.agent, type=t.type, content=t.content, evidence=t.evidence)
                for t in r.turns
            ],
        )
        for r in result.transcript
    ]

    synthesis = Synthesis(
        core_conflict=result.synthesis.core_conflict,
        resolution_suggestion=result.synthesis.resolution_suggestion,
        agreement_points=result.synthesis.agreement_points,
        divergence_points=result.synthesis.divergence_points,
    )

    return Debate(
        debate_id=f"debate_{uuid.uuid4().hex[:8]}",
        space_id=request.space_id,
        edge_id=edge.edge_id,
        participants=[agent_a.agent_id, agent_b.agent_id],
        transcript=transcript,
        synthesis=synthesis,
        visualization={},
    )


@router.post("/fallback")
def fallback_debate():
    """Return fallback debate when LLM is unavailable."""
    from services.generator import mock_data
    fb = mock_data.FALLBACK_DEBATES["default"]
    return fb
