import hashlib
import json
import math
from typing import Any, Optional
from openai import OpenAI
from app import config

_client: Optional[OpenAI] = None

# ---- Mock Data: 40-role pool ----

_ROLE_POOL = [
    {"name": "AI创业者", "persona": "连续创业者，窗口期敏感", "domain": "startup", "summary": "窗口期有限，AI基础设施已成熟", "base_auth": 0.75, "base_nov": 0.92, "stance_bias": "pro"},
    {"name": "大厂高管", "persona": "资深技术总监，稳健派", "domain": "enterprise", "summary": "体系内积累比盲目创业更稳妥", "base_auth": 0.88, "base_nov": 0.35, "stance_bias": "con"},
    {"name": "早期投资人", "persona": "专注AI赛道的VC", "domain": "investment", "summary": "关键在PMF验证，不是辞职本身", "base_auth": 0.82, "base_nov": 0.68, "stance_bias": "neutral"},
    {"name": "独立开发者", "persona": "全栈独立开发者，自由职业", "domain": "indie", "summary": "个人效率天花板正在被AI打破", "base_auth": 0.55, "base_nov": 0.85, "stance_bias": "pro"},
    {"name": "技术布道者", "persona": "开源社区活跃者，技术传播", "domain": "tech", "summary": "技术民主化是不可逆的趋势", "base_auth": 0.65, "base_nov": 0.78, "stance_bias": "pro"},
    {"name": "风险分析师", "persona": "投行量化分析师，风控导向", "domain": "finance", "summary": "技术泡沫估值远超实际价值", "base_auth": 0.85, "base_nov": 0.25, "stance_bias": "con"},
    {"name": "行业研究员", "persona": "咨询机构高级研究员", "domain": "research", "summary": "需要区分 hype 与 reality", "base_auth": 0.78, "base_nov": 0.42, "stance_bias": "neutral"},
    {"name": "产品经理", "persona": "大厂产品总监，用户导向", "domain": "product", "summary": "AI 是工具，不是目的", "base_auth": 0.72, "base_nov": 0.58, "stance_bias": "neutral"},
    {"name": "全栈工程师", "persona": "10年经验全栈，技术实用主义", "domain": "engineering", "summary": "技术栈会过时，架构思维不会", "base_auth": 0.68, "base_nov": 0.62, "stance_bias": "pro"},
    {"name": "数据科学家", "persona": "算法工程师，数据驱动", "domain": "data", "summary": "数据质量比模型复杂度更重要", "base_auth": 0.76, "base_nov": 0.55, "stance_bias": "neutral"},
    {"name": "技术作家", "persona": "知名技术博主，内容创作者", "domain": "media", "summary": "叙事能力决定技术 Adoption 速度", "base_auth": 0.52, "base_nov": 0.72, "stance_bias": "neutral"},
    {"name": "开源维护者", "persona": "热门开源项目核心维护者", "domain": "opensource", "summary": "开源生态是AI创新的基础设施", "base_auth": 0.60, "base_nov": 0.80, "stance_bias": "pro"},
    {"name": "大学教授", "persona": "计算机系教授，学术严谨", "domain": "academia", "summary": "学术研究与工业落地有本质差异", "base_auth": 0.90, "base_nov": 0.30, "stance_bias": "con"},
    {"name": "咨询顾问", "persona": "MBB高级顾问，战略思维", "domain": "consulting", "summary": "组织变革比技术变革更难", "base_auth": 0.80, "base_nov": 0.40, "stance_bias": "neutral"},
    {"name": "政策研究员", "persona": "科技政策研究所研究员", "domain": "policy", "summary": "监管框架需要与技术同步演进", "base_auth": 0.83, "base_nov": 0.28, "stance_bias": "con"},
    {"name": "区块链创业者", "persona": "Web3创业者，去中心化信仰", "domain": "crypto", "summary": "去中心化AI是下一波浪潮", "base_auth": 0.48, "base_nov": 0.95, "stance_bias": "pro"},
    {"name": "安全专家", "persona": "网络安全架构师，防御导向", "domain": "security", "summary": "AI系统的攻击面被严重低估", "base_auth": 0.77, "base_nov": 0.32, "stance_bias": "con"},
    {"name": "云架构师", "persona": "AWS/Azure认证架构师", "domain": "cloud", "summary": "云原生是AI部署的最佳实践", "base_auth": 0.74, "base_nov": 0.50, "stance_bias": "neutral"},
    {"name": "DevOps工程师", "persona": "SRE专家，基础设施即代码", "domain": "devops", "summary": "MLOps成熟度决定AI落地速度", "base_auth": 0.66, "base_nov": 0.60, "stance_bias": "neutral"},
    {"name": "UI/UX设计师", "persona": "设计系统专家，人机交互", "domain": "design", "summary": "AI的交互设计还在石器时代", "base_auth": 0.58, "base_nov": 0.70, "stance_bias": "neutral"},
    {"name": "增长黑客", "persona": "数据驱动增长，A/B测试狂魔", "domain": "growth", "summary": "AI可以放大增长飞轮10倍", "base_auth": 0.50, "base_nov": 0.88, "stance_bias": "pro"},
    {"name": "法务顾问", "persona": "科技法务专家，知识产权", "domain": "legal", "summary": "版权和合规风险尚未被正视", "base_auth": 0.84, "base_nov": 0.20, "stance_bias": "con"},
    {"name": "财务顾问", "persona": "CFA持证人，价值投资", "domain": "finance", "summary": "AI公司的估值模型需要重构", "base_auth": 0.86, "base_nov": 0.22, "stance_bias": "con"},
    {"name": "HR总监", "persona": "人才战略专家，组织发展", "domain": "hr", "summary": "AI正在重塑人才市场结构", "base_auth": 0.70, "base_nov": 0.45, "stance_bias": "con"},
    {"name": "市场营销", "persona": "品牌策略总监，消费者洞察", "domain": "marketing", "summary": "AI让个性化营销规模化", "base_auth": 0.56, "base_nov": 0.65, "stance_bias": "pro"},
    {"name": "运营专家", "persona": "精益运营，流程优化", "domain": "operations", "summary": "AI可以自动化80%的运营工作", "base_auth": 0.62, "base_nov": 0.52, "stance_bias": "neutral"},
    {"name": "供应链经理", "persona": "全球供应链优化专家", "domain": "supply", "summary": "AI预测准确率的边际效益递减", "base_auth": 0.73, "base_nov": 0.38, "stance_bias": "con"},
    {"name": "教育科技创业者", "persona": "EdTech创始人，终身学习", "domain": "edtech", "summary": "个性化教育是AI最确定的落地场景", "base_auth": 0.54, "base_nov": 0.82, "stance_bias": "pro"},
    {"name": "健康科技创业者", "persona": "数字健康创业者", "domain": "healthtech", "summary": "医疗AI的监管壁垒高于技术壁垒", "base_auth": 0.67, "base_nov": 0.75, "stance_bias": "neutral"},
    {"name": "金融科技创业者", "persona": "FinTech创始人，支付创新", "domain": "fintech", "summary": "金融AI的核心是风控不是算法", "base_auth": 0.69, "base_nov": 0.63, "stance_bias": "pro"},
    {"name": "环境科学家", "persona": "气候科技研究员，可持续", "domain": "env", "summary": "AI的碳足迹被系统性低估", "base_auth": 0.79, "base_nov": 0.48, "stance_bias": "con"},
    {"name": "社会学家", "persona": "数字社会学家，技术影响", "domain": "sociology", "summary": "技术变革加剧社会不平等", "base_auth": 0.81, "base_nov": 0.35, "stance_bias": "con"},
    {"name": "心理学家", "persona": "认知心理学家，人机认知", "domain": "psychology", "summary": "人类认知偏见是AI落地的最大障碍", "base_auth": 0.71, "base_nov": 0.56, "stance_bias": "neutral"},
    {"name": "哲学家", "persona": "科技哲学教授，伦理思辨", "domain": "philosophy", "summary": "我们需要重新定义什么是智能", "base_auth": 0.75, "base_nov": 0.66, "stance_bias": "neutral"},
    {"name": "经济学家", "persona": "行为经济学家，市场机制", "domain": "economics", "summary": "AI将重塑生产函数和劳动市场", "base_auth": 0.87, "base_nov": 0.40, "stance_bias": "neutral"},
    {"name": "历史学家", "persona": "技术史学家，长周期视角", "domain": "history", "summary": "每次技术革命都伴随泡沫和回调", "base_auth": 0.89, "base_nov": 0.18, "stance_bias": "con"},
    {"name": "未来学家", "persona": "趋势预测专家，远见思维", "domain": "futurology", "summary": "2030年的世界将与今天截然不同", "base_auth": 0.44, "base_nov": 0.96, "stance_bias": "pro"},
    {"name": "科幻作家", "persona": "硬科幻作家，想象力驱动", "domain": "scifi", "summary": "最疯狂的科幻正在成为现实", "base_auth": 0.38, "base_nov": 0.98, "stance_bias": "pro"},
    {"name": "科技记者", "persona": "独立科技记者，深度报道", "domain": "journalism", "summary": "媒体叙事影响公众对AI的认知", "base_auth": 0.53, "base_nov": 0.74, "stance_bias": "neutral"},
    {"name": "政府科技官员", "persona": "工信部/科技部官员，政策制定", "domain": "gov", "summary": "国家战略层面需要冷静评估", "base_auth": 0.91, "base_nov": 0.15, "stance_bias": "con"},
]

_MOCK_DEBATE_JSON = json.dumps({
    "transcript": [
        {
            "round": 1,
            "turns": [
                {
                    "agent": "agent_001",
                    "type": "argument",
                    "content": "AI应用层的窗口期约18个月，大厂经验可以直接转化为创业资源。",
                    "evidence": ["2024年AI融资数据", "头部AI公司成立时间"]
                },
                {
                    "agent": "agent_002",
                    "type": "rebuttal",
                    "content": "但首次创业失败率高达90%，盲目入场风险极大。",
                    "evidence": ["首次创业失败率统计"]
                }
            ]
        },
        {
            "round": 2,
            "turns": [
                {
                    "agent": "agent_001",
                    "type": "argument",
                    "content": "我们可以先用副业验证PMF，降低试错成本。",
                    "evidence": []
                },
                {
                    "agent": "agent_002",
                    "type": "rebuttal",
                    "content": "副业和全职创业的心态完全不同，无法真实验证。",
                    "evidence": []
                }
            ]
        }
    ],
    "synthesis": {
        "core_conflict": "风险判断的时间尺度不同",
        "resolution_suggestion": "先用副业验证PMF，降低试错成本",
        "agreement_points": ["AI是长期趋势", "需要准备而非冲动"],
        "divergence_points": ["最佳入场时机", "可接受的风险水平"]
    }
})


def _hash_int(text: str, index: int, mod: int) -> int:
    """Deterministic integer from text hash."""
    h = hashlib.md5(f"{text}:{index}".encode("utf-8")).hexdigest()
    return int(h[:8], 16) % mod


def _hash_float(text: str, index: int) -> float:
    """Deterministic float [0,1] from text hash."""
    h = hashlib.md5(f"{text}:{index}".encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _generate_mock_agents(query: str) -> str:
    """Generate 5-8 deterministic agents from 40-role pool based on query hash."""
    # Select 5-8 agents
    num_agents = 5 + _hash_int(query, 0, 4)  # 5 to 8
    # Shuffle index pool deterministically
    indices = list(range(len(_ROLE_POOL)))
    # Fisher-Yates shuffle with hash seed
    for i in range(len(indices) - 1, 0, -1):
        j = _hash_int(query, i + 100, i + 1)
        indices[i], indices[j] = indices[j], indices[i]

    selected = indices[:num_agents]
    agents = []

    for idx, role_idx in enumerate(selected):
        role = _ROLE_POOL[role_idx]
        # Perturb coordinates slightly based on query hash
        auth = max(0.0, min(1.0, role["base_auth"] + (_hash_float(query, idx * 2) - 0.5) * 0.15))
        nov = max(0.0, min(1.0, role["base_nov"] + (_hash_float(query, idx * 2 + 1) - 0.5) * 0.15))

        # Stance: mostly follow bias, occasionally flip
        stance = role["stance_bias"]
        flip = _hash_float(query, idx * 3 + 200)
        if flip < 0.08:
            stance = "pro" if stance != "pro" else "neutral"
        elif flip > 0.92:
            stance = "con" if stance != "con" else "neutral"

        agents.append({
            "agent_id": f"agent_{idx + 1:03d}",
            "name": role["name"],
            "persona": role["persona"],
            "position": {"authority": round(auth, 3), "novelty": round(nov, 3)},
            "stance": stance,
            "confidence": round(0.65 + _hash_float(query, idx * 4 + 300) * 0.25, 2),
            "domain": role["domain"],
            "summary": role["summary"],
        })

    return json.dumps({"agents": agents})


def _mock_embedding(text: str, dim: int = 1536) -> list[float]:
    """Generate deterministic embedding vector based on text hash."""
    h = hashlib.md5(text.encode("utf-8")).hexdigest()
    vec = [0.0] * dim
    for i in range(dim):
        seed = int(h[i % 32 : (i % 32) + 2], 16)
        vec[i] = (seed / 255.0) * 2 - 1
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def _mock_chat_completion(messages: list[dict[str, str]], json_mode: bool = False) -> str:
    """Return predefined mock data based on prompt content."""
    prompt_text = " ".join(m.get("content", "") for m in messages)

    if "辩论主持人" in prompt_text or "transcript" in prompt_text:
        return _MOCK_DEBATE_JSON

    # Extract query from user message for deterministic generation
    query = ""
    for m in messages:
        if m.get("role") == "user" and "问题：" in m.get("content", ""):
            query = m.get("content", "").split("问题：")[-1].split("\n")[0].strip()
            break
    if not query:
        query = prompt_text[:50]

    return _generate_mock_agents(query)


# ---- Real Client ----

def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY or config.OPENAI_API_KEY == "your-api-key-here":
            raise RuntimeError(
                "OPENAI_API_KEY not configured. Please set it in .env file, or set MOCK_LLM=true"
            )
        _client = OpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_BASE_URL,
        )
    return _client


def chat_completion(
    messages: list[dict[str, str]],
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
    if config.MOCK_LLM:
        return _mock_chat_completion(messages, json_mode)

    client = get_client()
    kwargs: dict[str, Any] = {
        "model": config.MODEL_NAME,
        "messages": messages,
        "temperature": temperature,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    resp = client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""


def get_embedding(text: str) -> list[float]:
    if config.MOCK_LLM:
        return _mock_embedding(text)

    client = get_client()
    resp = client.embeddings.create(
        model=config.EMBED_MODEL,
        input=text,
    )
    return resp.data[0].embedding
