import hashlib
import json
import math
from typing import Any, Optional
from openai import OpenAI
from app import config

_client: Optional[OpenAI] = None

# ---- Mock Data ----

_MOCK_AGENTS_JSON = json.dumps({
    "agents": [
        {
            "agent_id": "agent_001",
            "name": "AI创业者",
            "persona": "连续创业者，窗口期敏感",
            "position": {"authority": 0.75, "novelty": 0.92},
            "stance": "pro",
            "confidence": 0.85,
            "domain": "startup",
            "summary": "窗口期有限，AI基础设施已成熟"
        },
        {
            "agent_id": "agent_002",
            "name": "大厂高管",
            "persona": "资深技术总监，稳健派",
            "position": {"authority": 0.88, "novelty": 0.35},
            "stance": "con",
            "confidence": 0.82,
            "domain": "enterprise",
            "summary": "体系内积累比盲目创业更稳妥"
        },
        {
            "agent_id": "agent_003",
            "name": "早期投资人",
            "persona": "专注AI赛道的VC",
            "position": {"authority": 0.82, "novelty": 0.68},
            "stance": "neutral",
            "confidence": 0.78,
            "domain": "investment",
            "summary": "关键在PMF验证，不是辞职本身"
        }
    ]
})

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


def _mock_embedding(text: str, dim: int = 1536) -> list[float]:
    """Generate deterministic embedding vector based on text hash."""
    h = hashlib.md5(text.encode("utf-8")).hexdigest()
    vec = [0.0] * dim
    # Spread hash values across vector dimensions
    for i in range(dim):
        seed = int(h[i % 32 : (i % 32) + 2], 16)
        vec[i] = (seed / 255.0) * 2 - 1  # range [-1, 1]
    # Normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def _mock_chat_completion(messages: list[dict[str, str]], json_mode: bool = False) -> str:
    """Return predefined mock data based on prompt content."""
    prompt_text = " ".join(m.get("content", "") for m in messages)

    if "辩论主持人" in prompt_text or "transcript" in prompt_text:
        return _MOCK_DEBATE_JSON

    # Default: space creation
    return _MOCK_AGENTS_JSON


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
