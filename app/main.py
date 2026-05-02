from fastapi import FastAPI
from app.routers import spaces, export

app = FastAPI(
    title="Cognitive Space API",
    description="多智能体辩论与认知扩展系统",
    version="0.1.0",
)

app.include_router(spaces.router)
app.include_router(export.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
