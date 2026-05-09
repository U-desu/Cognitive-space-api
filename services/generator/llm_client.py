"""LLM Client for Generator Service.

Handles real OpenAI-compatible API calls with fallback on failure.

Future cache layer (Redis):
- embedding_cache: text_hash -> vector
- debate_cache: (edge_hash) -> debate_json
- agent_cache: (query_hash) -> agents_json
"""

import hashlib
import json
from typing import Any, Optional
from openai import OpenAI
from services.shared import config
from services.generator import preset_data

_client: Optional[OpenAI] = None

# Simple in-memory cache (future: Redis)
_embedding_cache: dict[str, list[float]] = {}


def _fallback_debate() -> dict:
    """Return fallback debate when LLM fails."""
    return preset_data.FALLBACK_DEBATES["default"]


# ── Real Client ──

def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not config.API_KEY or config.API_KEY == "your-api-key-here":
            provider = config.LLM_PROVIDER
            raise RuntimeError(
                f"API key not configured for provider '{provider}'. "
                f"Set {provider.upper()}_API_KEY environment variable."
            )
        _client = OpenAI(api_key=config.API_KEY, base_url=config.API_BASE_URL)
    return _client


def chat_completion(
    messages: list[dict[str, str]],
    json_mode: bool = False,
    temperature: float = 0.7,
) -> str:
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

    client = get_client()
    resp = client.embeddings.create(model=config.EMBED_MODEL, input=text)
    vec = resp.data[0].embedding
    _embedding_cache[cache_key] = vec
    return vec
