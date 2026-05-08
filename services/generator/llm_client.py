"""LLM Client for Generator Service.

Handles both real OpenAI API and mock mode.
Mock data lives in mock_data.py for clean separation.

Future cache layer (Redis):
- embedding_cache: text_hash -> vector
- debate_cache: (edge_hash) -> debate_json
- agent_cache: (query_hash) -> agents_json
"""

import hashlib
import json
import math
import re
from typing import Any, Optional
from openai import OpenAI
from services.shared import config
from services.generator import mock_data

_client: Optional[OpenAI] = None

# Simple in-memory cache (future: Redis)
_embedding_cache: dict[str, list[float]] = {}


def _hash_int(text: str, index: int, mod: int) -> int:
    h = hashlib.md5(f"{text}:{index}".encode("utf-8")).hexdigest()
    return int(h[:8], 16) % mod


def _hash_float(text: str, index: int) -> float:
    h = hashlib.md5(f"{text}:{index}".encode("utf-8")).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _find_role(name: str) -> dict:
    for role in mock_data.ROLE_POOL:
        if role["name"] == name:
            return role
    return mock_data.ROLE_POOL[0]


def _match_preset(query: str) -> str:
    q = query.strip()
    if "程序" in q or "取代" in q or "失业" in q or "替代" in q:
        return "AI发展这么快，程序员会被取代吗？"
    if "管理" in q or "转管理" in q or "深耕技术" in q or "技术还是管理" in q:
        return "30岁该继续深耕技术还是转管理？"
    return "大厂5年了，该辞职去做AI创业吗？"


def _generate_mock_agents(query: str) -> str:
    preset_key = _match_preset(query)
    preset = mock_data.QUESTION_AGENT_PRESETS[preset_key]
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
    prompt_text = " ".join(m.get("content", "") for m in messages)
    query = ""
    for m in messages:
        if m.get("role") == "user" and "问题：" in m.get("content", ""):
            query = m.get("content", "").split("问题：")[-1].split("\n")[0].strip()
            break
    if not query:
        query = prompt_text[:50]

    preset_key = _match_preset(query)

    if "辩论主持人" in prompt_text or "transcript" in prompt_text:
        debate_json = mock_data.DEBATE_PRESETS.get(preset_key, mock_data.DEBATE_PRESETS["大厂5年了，该辞职去做AI创业吗？"])
        match = re.search(r'\[AGENTS:([^,]+),([^\]]+)\]', prompt_text)
        if match:
            source_id = match.group(1).strip()
            target_id = match.group(2).strip()
            debate_json = debate_json.replace('"agent_001"', f'"{source_id}"')
            debate_json = debate_json.replace('"agent_002"', f'"{target_id}"')
        return debate_json

    return _generate_mock_agents(query)


def _fallback_debate() -> dict:
    """Return fallback debate when LLM fails."""
    return mock_data.FALLBACK_DEBATES["default"]


# ── Real Client ──

def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY or config.OPENAI_API_KEY == "your-api-key-here":
            raise RuntimeError("OPENAI_API_KEY not configured. Set MOCK_LLM=true for mock mode.")
        _client = OpenAI(api_key=config.OPENAI_API_KEY, base_url=config.OPENAI_BASE_URL)
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

    try:
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""
    except Exception as e:
        # Return fallback in production if LLM fails
        if json_mode and "transcript" in str(messages):
            return json.dumps(_fallback_debate())
        raise


def get_embedding(text: str) -> list[float]:
    # Check cache first
    cache_key = hashlib.md5(text.encode()).hexdigest()
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    if config.MOCK_LLM:
        vec = _mock_embedding(text)
        _embedding_cache[cache_key] = vec
        return vec

    client = get_client()
    resp = client.embeddings.create(model=config.EMBED_MODEL, input=text)
    vec = resp.data[0].embedding
    _embedding_cache[cache_key] = vec
    return vec
