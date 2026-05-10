"""Aggregator Service - Third-Party Data Aggregation.

Port: 8004
Responsibility:
- Aggregate external data (Zhihu users, questions)
- Provide preset data (hot questions, domain labels)

Current: static data (migrated from frontend)
Future:
- Zhihu API integration with rate limiting
- Elasticsearch for semantic question/user search
- MongoDB for document caching
- Redis for hot data caching
"""

from fastapi import FastAPI
from services.aggregator.routers import zhihu, presets

app = FastAPI(
    title="Aggregator Service",
    description="Third-party data aggregation for Cognitive Space",
    version="0.2.0",
)

app.include_router(zhihu.router)
app.include_router(zhihu.domain_router)
app.include_router(presets.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "aggregator"}
