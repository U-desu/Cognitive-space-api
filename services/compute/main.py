"""Compute Service - Pure Mathematical Computation.

Port: 8003
Responsibility:
- Compute conflict edges between agents (cosine distance on embeddings)
- Compute cognitive metrics from user trajectories (coverage, depth, breadth, engagement)

Stateless: can be horizontally scaled without shared storage.
No database needed — all inputs come via HTTP requests, outputs returned immediately.
"""

from fastapi import FastAPI
from services.compute.routers import edges, metrics, embed

app = FastAPI(
    title="Compute Service",
    description="Pure mathematical computation for Cognitive Space",
    version="0.2.0",
)

app.include_router(edges.router)
app.include_router(metrics.router)
app.include_router(embed.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "compute"}
