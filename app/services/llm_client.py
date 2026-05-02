import json
from typing import Any, Optional
from openai import OpenAI
from app import config

_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY or config.OPENAI_API_KEY == "your-api-key-here":
            raise RuntimeError(
                "OPENAI_API_KEY not configured. Please set it in .env file."
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
    client = get_client()
    resp = client.embeddings.create(
        model=config.EMBED_MODEL,
        input=text,
    )
    return resp.data[0].embedding
