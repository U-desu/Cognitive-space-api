import os
from dotenv import load_dotenv

load_dotenv()

# ── LLM ──
# Supports OpenAI-compatible providers: OpenAI, DeepSeek, Kimi, etc.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# Resolved API config based on provider
if LLM_PROVIDER == "deepseek":
    API_KEY = DEEPSEEK_API_KEY or OPENAI_API_KEY
    API_BASE_URL = DEEPSEEK_BASE_URL
    MODEL_NAME = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
else:
    API_KEY = OPENAI_API_KEY
    API_BASE_URL = OPENAI_BASE_URL
    MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")

EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")
MOCK_LLM = os.getenv("MOCK_LLM", "false").lower() == "true"
