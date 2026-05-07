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

def _build_debate_json(transcript: list, synthesis: dict) -> str:
    return json.dumps({"transcript": transcript, "synthesis": synthesis})


# ---- Per-question debate presets ----
_DEBATE_PRESETS = {
    "大厂5年了，该辞职去做AI创业吗？": _build_debate_json(
        transcript=[
            {
                "round": 1,
                "turns": [
                    {"agent": "agent_001", "type": "argument", "content": "大厂5年积累的技术洞察、行业人脉和资金储备，正是AI创业最稀缺的启动资本。当前AI应用层窗口期约18个月，错过这波将失去先发优势。", "evidence": ["2024年AI应用层融资同比增长300%", "头部AI创业公司创始人平均大厂背景5.2年"]},
                    {"agent": "agent_002", "type": "rebuttal", "content": "但数据显示首次创业失败率高达92%，大厂光环在创业战场并不值钱。稳定的年薪、股票和五险一金，是35岁前最该珍惜的杠杆。", "evidence": ["《中国创业者生存报告》：首次创业失败率92.3%", "大厂P8以上年薪中位数80万+"]},
                ]
            },
            {
                "round": 2,
                "turns": [
                    {"agent": "agent_001", "type": "argument", "content": "所以我们不应该all in，而是先用副业验证PMF——下班后跑通MVP、验证付费意愿，降低试错成本。", "evidence": ["YC校友调研：副业验证后创业成功率提升至35%"]},
                    {"agent": "agent_002", "type": "rebuttal", "content": "副业和全职创业是完全两种心态。下班后做side project是兴趣驱动，全职创业是生存驱动——用户付费意愿、团队招募速度、抗压能力，在副业模式下根本无法真实验证。", "evidence": ["副业项目的用户留存率平均仅为全职项目的1/5"]},
                ]
            },
        ],
        synthesis={
            "core_conflict": "风险判断的时间尺度不同：创业者看18个月窗口期，稳健派看35岁前的职业安全边际",
            "resolution_suggestion": "建议用3-6个月副业深度验证PMF，若月活>1000且付费转化>5%，再考虑全职；否则继续深耕大厂并积累行业资源",
            "agreement_points": ["AI是长期趋势不可逆", "需要准备而非冲动", "大厂经验是宝贵资产"],
            "divergence_points": ["最佳入场时机（现在 vs 3年后）", "可接受的风险水平（all in vs 副业验证）", "成功概率评估（8% vs 35%）"]
        }
    ),
    "AI发展这么快，程序员会被取代吗？": _build_debate_json(
        transcript=[
            {
                "round": 1,
                "turns": [
                    {"agent": "agent_001", "type": "argument", "content": "AI不是程序员的终结者，而是超级生产力工具。Copilot让编码效率提升55%，程序员从写代码转向架构设计和需求抽象，岗位总量不会减少只会升级。", "evidence": ["GitHub Copilot报告：编码效率提升55%", "Stack Overflow调研：仅12%开发者担心被AI取代"]},
                    {"agent": "agent_002", "type": "rebuttal", "content": "你混淆了'工具增强'和'岗位替代'。当AI能自动生成80%的业务代码时，企业需要的人手会指数级下降。初级程序员、CRUD工程师已经面临裁撤。", "evidence": ["2024年硅谷初级程序员岗位下降37%", "Databricks CEO：AI将消灭50%的纯编码岗位"]},
                ]
            },
            {
                "round": 2,
                "turns": [
                    {"agent": "agent_001", "type": "argument", "content": "历史已经证明这一点——蒸汽机没有消灭工人，Excel没有消灭会计，反而创造了更多高阶岗位。程序员的核心竞争力从来不是敲键盘的速度，而是系统思维和问题拆解能力。", "evidence": ["工业革命后全球就业总量增长400%", "软件工程师岗位过去20年增长10倍"]},
                    {"agent": "agent_002", "type": "rebuttal", "content": "但这次不同——AI替代的是认知劳动，不是体力劳动。当AI不仅能写代码，还能debug、写测试、做code review时，'系统思维'这张牌也保不了你多久。", "evidence": ["OpenAI研究：GPT-5级模型在LeetCode hard上准确率已达72%", "Google DeepMind：AI已能自主修复开源项目bug"]},
                ]
            },
        ],
        synthesis={
            "core_conflict": "工具增强 vs 岗位替代：AI提升了单程序员产出，但是否会压缩整体岗位需求？",
            "resolution_suggestion": "建议程序员向'AI+领域专家'转型——深耕垂直行业（金融、医疗、制造），掌握AI工具链，将不可替代性从'编码能力'转移到'业务理解+架构设计'",
            "agreement_points": ["AI将深刻改变编程工作流", "高阶思维能力越来越重要", "持续学习是生存底线"],
            "divergence_points": ["岗位总量变化（增长 vs 萎缩）", "初级程序员的生存空间", "转型窗口期长度"]
        }
    ),
    "30岁该继续深耕技术还是转管理？": _build_debate_json(
        transcript=[
            {
                "round": 1,
                "turns": [
                    {"agent": "agent_001", "type": "argument", "content": "管理路线是中国互联网唯一的上升通道。30岁不转管理，35岁就会被P8+的管理者领导，职业天花板触手可及。技术再深，也敌不过组织权力。", "evidence": ["大厂技术岗晋升P9平均需要12年，管理岗仅需7年", "35岁以上纯技术岗留存率不足30%"]},
                    {"agent": "agent_002", "type": "rebuttal", "content": "恰恰因为大家都在转管理，技术深耕才是差异化壁垒。全球顶尖架构师年薪500万+，且不受年龄限制。管理的'可替代性'远高于技术的'不可替代性'。", "evidence": ["硅谷Staff+工程师平均年薪$800K", "Linus Torvalds 54岁仍是一线核心开发者"]},
                ]
            },
            {
                "round": 2,
                "turns": [
                    {"agent": "agent_001", "type": "argument", "content": "但你要想清楚——管理能力是复利资产，技术能力是折旧资产。管理经验的迁移性（跨公司、跨行业）远高于特定技术栈。", "evidence": ["MBA毕业生10年平均薪资增长280%，工程师仅95%", "管理者跨行业成功率是技术专家的3倍"]},
                    {"agent": "agent_002", "type": "rebuttal", "content": "管理的'迁移性'是幻觉——你在A公司的团队管理方法论，在B公司可能完全不适用。而系统架构思维、算法功底、工程判断力，是真正的跨时代能力。", "evidence": ["《哈佛商业评论》：70%的管理者跨公司表现低于预期", "系统设计能力是工程师35岁后最值钱的技能"]},
                ]
            },
        ],
        synthesis={
            "core_conflict": "深度专精 vs 广度管理：技术路线的不可替代性 vs 管理路线的天花板高度",
            "resolution_suggestion": "建议用'T型策略'——在30-35岁保持技术深度（成为领域专家或架构师），同时选择性承担小型项目管理（3-5人），35岁后根据'产品型人格'或'技术型人格'做最终选择",
            "agreement_points": ["30岁是职业分水岭", "需要主动规划而非被动等待", "大厂环境对纯技术路线不友好"],
            "divergence_points": ["天花板定义（薪资 vs 影响力）", "年龄友好度（技术岗 vs 管理岗）", "个人特质匹配度"]
        }
    ),
}


# ---- Per-question agent presets ----
_QUESTION_AGENT_PRESETS = {
    "大厂5年了，该辞职去做AI创业吗？": [
        {"name": "AI创业者", "stance": "pro"},
        {"name": "大厂高管", "stance": "con"},
        {"name": "早期投资人", "stance": "neutral"},
        {"name": "风险分析师", "stance": "con"},
        {"name": "独立开发者", "stance": "pro"},
        {"name": "财务顾问", "stance": "con"},
    ],
    "AI发展这么快，程序员会被取代吗？": [
        {"name": "技术布道者", "stance": "pro"},
        {"name": "大学教授", "stance": "con"},
        {"name": "全栈工程师", "stance": "pro"},
        {"name": "心理学家", "stance": "neutral"},
        {"name": "哲学家", "stance": "neutral"},
        {"name": "科技记者", "stance": "neutral"},
    ],
    "30岁该继续深耕技术还是转管理？": [
        {"name": "大厂高管", "stance": "con"},
        {"name": "全栈工程师", "stance": "pro"},
        {"name": "HR总监", "stance": "neutral"},
        {"name": "咨询顾问", "stance": "neutral"},
        {"name": "产品经理", "stance": "neutral"},
        {"name": "技术作家", "stance": "pro"},
    ],
}


def _hash_int(text: str, index: int, mod: int) -> int:
    """Deterministic integer from text hash."""
    h = hashlib.md5(f"{text}:{index}".encode("utf-8")).hexdigest()
    return int(h[:8], 16) % mod


def _hash_float(text: str, index: int) -> float:
    """Deterministic float [0,1] from text hash."""
    h = hashlib.md5(f"{text}:{index}".encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _find_role(name: str) -> dict:
    for role in _ROLE_POOL:
        if role["name"] == name:
            return role
    return _ROLE_POOL[0]


def _match_preset(query: str) -> str:
    """Match query to one of the 3 demo questions."""
    q = query.strip()
    if "程序" in q or "取代" in q or "失业" in q or "替代" in q:
        return "AI发展这么快，程序员会被取代吗？"
    if "管理" in q or "转管理" in q or "深耕技术" in q or "技术还是管理" in q:
        return "30岁该继续深耕技术还是转管理？"
    return "大厂5年了，该辞职去做AI创业吗？"


def _generate_mock_agents(query: str) -> str:
    """Generate fixed agent composition based on query match."""
    preset_key = _match_preset(query)
    preset = _QUESTION_AGENT_PRESETS[preset_key]
    agents = []

    for idx, cfg in enumerate(preset):
        role = _find_role(cfg["name"])
        agents.append({
            "agent_id": f"agent_{idx + 1:03d}",
            "name": role["name"],
            "persona": role["persona"],
            "position": {"authority": round(role["base_auth"], 3), "novelty": round(role["base_nov"], 3)},
            "stance": cfg["stance"],
            "confidence": round(0.72 + idx * 0.03, 2),
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

    # Extract query from user message
    query = ""
    for m in messages:
        if m.get("role") == "user" and "问题：" in m.get("content", ""):
            query = m.get("content", "").split("问题：")[-1].split("\n")[0].strip()
            break
    if not query:
        query = prompt_text[:50]

    preset_key = _match_preset(query)

    if "辩论主持人" in prompt_text or "transcript" in prompt_text:
        debate_json = _DEBATE_PRESETS.get(preset_key, _DEBATE_PRESETS["大厂5年了，该辞职去做AI创业吗？"])
        # Replace hardcoded agent IDs with actual participants from prompt
        import re
        match = re.search(r'\[AGENTS:([^,]+),([^\]]+)\]', prompt_text)
        if match:
            source_id = match.group(1).strip()
            target_id = match.group(2).strip()
            debate_json = debate_json.replace('"agent_001"', f'"{source_id}"')
            debate_json = debate_json.replace('"agent_002"', f'"{target_id}"')
        return debate_json

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
