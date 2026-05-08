"""DebateState: manages conversation context for multi-agent debate."""

from typing import Optional
from services.shared.models import Agent, Edge, Turn


class DebateState:
    """Holds the full context of an ongoing debate.

    Passed to each DebateAgent.invoke() so the agent can see:
    - The debate topic and edge information
    - All previous turns (conversation history)
    - Its own persona and stance
    - Current round number and expected turn type
    """

    def __init__(
        self,
        agent_a: Agent,
        agent_b: Agent,
        edge: Edge,
        rounds: int,
        focus_axes: Optional[list[str]] = None,
    ):
        self.agent_a = agent_a
        self.agent_b = agent_b
        self.edge = edge
        self.rounds = rounds
        self.focus_axes = focus_axes or []
        self.turns: list[Turn] = []
        self.current_round = 1

    # ── Turn management ──

    def add_turn(self, turn: Turn) -> None:
        self.turns.append(turn)
        # Advance round counter after every pair of turns
        if len(self.turns) % 2 == 0:
            self.current_round += 1

    def is_complete(self) -> bool:
        """All expected turns have been generated."""
        return len(self.turns) >= self.rounds * 2

    def next_speaker(self) -> Agent:
        """Return the agent whose turn it is next."""
        return self.agent_a if len(self.turns) % 2 == 0 else self.agent_b

    def next_turn_type(self) -> str:
        """Even-indexed turns (0, 2, 4…) are arguments; odd are rebuttals."""
        return "argument" if len(self.turns) % 2 == 0 else "rebuttal"

    def get_opponent(self, agent: Agent) -> Agent:
        """Return the other agent."""
        return self.agent_b if agent.agent_id == self.agent_a.agent_id else self.agent_a

    # ── Prompt builders ──

    def _history_text(self) -> str:
        """Format previous turns as a dialogue transcript."""
        if not self.turns:
            return "（辩论刚刚开始，尚无历史记录）"
        lines = []
        current_round = 0
        for t in self.turns:
            # Re-compute round from turn index for display
            r = (len(lines) // 2) + 1
            if r != current_round:
                current_round = r
                lines.append(f"\n--- 第 {current_round} 轮 ---")
            agent = self.agent_a if t.agent == self.agent_a.agent_id else self.agent_b
            lines.append(f"{agent.name}（{t.type}）：{t.content}")
        return "\n".join(lines)

    def _divergence_text(self) -> str:
        """Format divergence axes for the prompt."""
        if not self.edge.divergence_axes:
            return "双方在该议题上存在根本性分歧。"
        lines = ["双方的分歧轴："]
        for d in self.edge.divergence_axes:
            lines.append(f"  - {d.axis}：{d.a_stance} vs {d.b_stance}")
        return "\n".join(lines)

    def build_prompt_for(self, agent: Agent) -> str:
        """Build the full human prompt for a single turn generation."""
        opponent = self.get_opponent(agent)
        turn_type = self.next_turn_type()
        history = self._history_text()
        divergence = self._divergence_text()
        focus = ""
        if self.focus_axes:
            focus = f"\n请特别围绕以下分歧轴展开：{', '.join(self.focus_axes)}"

        type_instruction = {
            "argument": "发表你的立论。请清晰阐述你的核心观点，并给出具体论据。",
            "rebuttal": "对对方上一轮的观点进行直接反驳。请指出对方论证中的漏洞或盲点，并强化你的立场。",
        }.get(turn_type, "发表你的观点。")

        return f"""辩论主题：{self.edge.source} 与 {self.edge.target} 之间的认知冲突

你的身份：
- 姓名：{agent.name}
- 人设：{agent.persona}
- 立场：{agent.stance}
- 核心观点：{agent.summary}

对方身份：
- 姓名：{opponent.name}
- 人设：{opponent.persona}
- 立场：{opponent.stance}

{divergence}
{focus}

当前轮次：第 {self.current_round} 轮 / 共 {self.rounds} 轮
你的任务：{type_instruction}

辩论历史：
{history}

请直接输出你的发言内容（纯文本，不需要任何前缀或格式标记）："""

    def build_moderator_prompt(self) -> str:
        """Build the prompt for synthesis generation."""
        history = self._history_text()
        agent_names = f"{self.agent_a.name}（{self.agent_a.stance}） vs {self.agent_b.name}（{self.agent_b.stance}）"
        return f"""你是一位认知合成专家。请基于以下辩论记录，生成结构化总结。

辩论双方：{agent_names}

辩论历史：
{history}

请输出以下内容（严格 JSON 格式）：
{{
  "core_conflict": "核心冲突的本质（一句话）",
  "resolution_suggestion": "给提问者的具体建议（一句话）",
  "agreement_points": ["共识点1", "共识点2"],
  "divergence_points": ["分歧点1", "分歧点2"]
}}"""
