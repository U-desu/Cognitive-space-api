"""Shared configuration utilities.

Each service reads its own SERVICE_NAME and SERVICE_PORT from env.
Other services' addresses are discovered via env vars.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── LLM ──
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "gpt-4o-mini")
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")
MOCK_LLM = os.getenv("MOCK_LLM", "false").lower() == "true"

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
