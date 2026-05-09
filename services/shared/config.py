"""Shared configuration utilities.

Each service reads its own SERVICE_NAME and SERVICE_PORT from env.
Other services' addresses are discovered via env vars.
"""

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

# ── Compute Embedding Backend ──
# "local"   -> sentence-transformers (requires: pip install sentence-transformers)
# "openai"  -> OpenAI API (requires: OPENAI_API_KEY)
# "keyword" -> domain-keyword semantic vectors (default, no deps)
COMPUTE_EMBED_BACKEND = os.getenv("COMPUTE_EMBED_BACKEND", "keyword")
COMPUTE_LOCAL_MODEL = os.getenv("COMPUTE_LOCAL_MODEL", "all-MiniLM-L6-v2")
COMPUTE_OPENAI_MODEL = os.getenv("COMPUTE_OPENAI_MODEL", "text-embedding-3-small")

# ── Service Discovery ──
# In production/docker these would be DNS names
GATEWAY_PORT = int(os.getenv("GATEWAY_PORT", "8000"))
CORE_PORT = int(os.getenv("CORE_PORT", "8001"))
GENERATOR_PORT = int(os.getenv("GENERATOR_PORT", "8002"))
COMPUTE_PORT = int(os.getenv("COMPUTE_PORT", "8003"))
AGGREGATOR_PORT = int(os.getenv("AGGREGATOR_PORT", "8004"))

CORE_URL = os.getenv("CORE_URL", f"http://127.0.0.1:{CORE_PORT}")
GENERATOR_URL = os.getenv("GENERATOR_URL", f"http://127.0.0.1:{GENERATOR_PORT}")
COMPUTE_URL = os.getenv("COMPUTE_URL", f"http://127.0.0.1:{COMPUTE_PORT}")
AGGREGATOR_URL = os.getenv("AGGREGATOR_URL", f"http://127.0.0.1:{AGGREGATOR_PORT}")

# ── Auth / JWT ──
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))

# ── OAuth ──
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/auth/github/callback")
