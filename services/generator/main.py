"""Generator Service - LLM Generation.

Port: 8002
Responsibility:
- Generate Agent lists from user query (LLM / preset)
- Generate Debate transcripts and synthesis (LLM / preset)
- Generate text embeddings (OpenAI API / cached)

Future cache layer (Redis):
- embedding_cache: text_hash -> vector (TTL: permanent)
- debate_cache: (edge_hash) -> debate_json (TTL: 7 days)
- agent_cache: (query_hash) -> agents_json (TTL: 1 hour, agents may vary)
"""

from fastapi import FastAPI
from services.generator.routers import agents, debates, embeddings

app = FastAPI(
    title="Generator Service",
    description="LLM-powered content generation for Cognitive Space",
    version="0.2.0",
)

app.include_router(agents.router)
app.include_router(debates.router)
app.include_router(embeddings.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "generator"}
