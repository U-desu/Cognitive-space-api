"""Core Service - Business Structured Data.

Port: 8001
Responsibility:
- Store and retrieve Space, Agent, Edge, Debate, Trajectory
- In-memory only for now; designed for PostgreSQL migration

Future DB mapping:
- spaces      → PostgreSQL table (JSONB for dimensions/metadata)
- agents      → PostgreSQL table (FK to spaces)
- edges       → PostgreSQL table (FK to spaces, source/target → agents)
- debates     → PostgreSQL table (FK to edges, JSONB for transcript/synthesis)
- trajectories → PostgreSQL table (JSONB for path/metrics, time-series index)
"""

from fastapi import FastAPI
from services.core.routers import spaces, edges, debates, trajectories, export

app = FastAPI(
    title="Core Service",
    description="Business structured data storage for Cognitive Space",
    version="0.2.0",
)

app.include_router(spaces.router)
app.include_router(edges.router)
app.include_router(debates.router)
app.include_router(trajectories.router)
app.include_router(export.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "core"}
