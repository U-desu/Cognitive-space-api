import asyncio
import uuid
from typing import Optional
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.routers import spaces, export
from app import store
from app.models.agent import Agent
from app.models.space import Space
from app.models.debate import DebateRequest
from app.services import debate_service, llm_client

# Re-use gateway auth modules in monolithic mode
from services.shared.models import UserRegisterRequest, UserLoginRequest
from services.gateway.auth.jwt import create_access_token, COOKIE_NAME, get_current_user
from services.gateway.auth.password_auth import register_user, authenticate_user
from services.gateway.auth.store import get_user

app = FastAPI(
    title="Cognitive Space API",
    description="多智能体辩论与认知扩展系统",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spaces.router)
app.include_router(export.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── Auth Routes ──

@app.post("/auth/register")
async def auth_register(request: UserRegisterRequest):
    try:
        user = register_user(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    token = create_access_token(user.user_id)
    response = JSONResponse(content={"user": user.model_dump()})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return response


@app.post("/auth/login")
async def auth_login(request: UserLoginRequest):
    user = authenticate_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user.user_id)
    response = JSONResponse(content={"user": user.model_dump()})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return response


@app.get("/auth/me")
async def auth_me(user: Optional[dict] = Depends(get_current_user)):
    if not user:
        return {"user": None}
    full_user = get_user(user["user_id"])
    return {"user": full_user.model_dump() if full_user else None}


# ── Aggregator Presets ──

@app.get("/aggregator/presets/hot-questions")
async def get_hot_questions():
    return [
        {
            "text": "大厂5年了，该辞职去做AI创业吗？",
            "label": "职业选择",
            "icon_type": "briefcase",
            "color": "#6366f1",
        },
        {
            "text": "AI发展这么快，程序员会被取代吗？",
            "label": "行业趋势",
            "icon_type": "code",
            "color": "#06b6d4",
        },
        {
            "text": "30岁该继续深耕技术还是转管理？",
            "label": "成长路径",
            "icon_type": "heart",
            "color": "#ec4899",
        },
    ]


# ── Aggregator Mock Data ──

@app.get("/aggregator/domain-labels")
async def get_domain_labels():
    return {
        "startup": "创业",
        "enterprise": "企业",
        "investment": "投资",
        "indie": "独立开发",
        "tech": "技术",
        "finance": "金融",
        "research": "研究",
        "product": "产品",
        "engineering": "工程",
        "data": "数据",
        "media": "媒体",
        "opensource": "开源",
        "academia": "学术",
        "consulting": "咨询",
        "policy": "政策",
        "crypto": "区块链",
        "security": "安全",
        "cloud": "云",
        "devops": "DevOps",
        "design": "设计",
        "growth": "增长",
        "legal": "法务",
        "hr": "人力资源",
        "marketing": "市场",
        "operations": "运营",
        "supply": "供应链",
        "edtech": "教育科技",
        "healthtech": "健康科技",
        "fintech": "金融科技",
        "env": "环境",
        "sociology": "社会学",
        "psychology": "心理学",
        "philosophy": "哲学",
        "economics": "经济学",
        "history": "历史",
        "futurology": "未来学",
        "scifi": "科幻",
        "journalism": "新闻",
        "gov": "政府",
    }


@app.get("/aggregator/zhihu/users")
async def get_zhihu_users(domain: str):
    mock_users = [
        {"name": "张逸", "title": "AI产品经理 · 前字节跳动", "followers": "12.5万", "avatar": "👤", "url": "https://zhihu.com"},
        {"name": "李思远", "title": "独立开发者 · 开源贡献者", "followers": "8.3万", "avatar": "👨‍💻", "url": "https://zhihu.com"},
        {"name": "王建国", "title": "科技专栏作家", "followers": "25万", "avatar": "✍️", "url": "https://zhihu.com"},
    ]
    return mock_users


@app.get("/aggregator/zhihu/questions")
async def get_zhihu_questions(query: str):
    mock_questions = [
        {"title": f"如何看待{query}？", "views": "234万", "url": "https://zhihu.com"},
        {"title": f"{query}，你支持哪一方？", "views": "156万", "url": "https://zhihu.com"},
        {"title": f"为什么越来越多人在讨论{query}？", "views": "89万", "url": "https://zhihu.com"},
    ]
    return mock_questions


# ── SSE Stream Debate ──

@app.post("/spaces/{space_id}/debates/stream")
async def create_debate_stream(space_id: str, request: DebateRequest):
    """Stream debate generation via SSE.
    
    Uses the synchronous debate_service under the hood, then simulates
    streaming by emitting pre-generated turns with delays.
    """
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    edge = store.get_edge(space_id, request.edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    
    # Generate full debate upfront (synchronous)
    debate = debate_service.run_debate(edge, space.agents, request)
    store.save_debate(debate)
    
    # Record trajectory
    from app.services import trajectory_service
    trajectory_service.record_action(space_id, request.edge_id, "debate", dwell_time=45)
    traj = store.get_or_create_trajectory(space_id)
    trajectory_service.compute_metrics(space, traj)
    
    async def event_stream():
        # Emit each turn as a separate SSE event
        turn_index = 0
        for round_obj in debate.transcript:
            for turn in round_obj.turns:
                event_data = {
                    "round": round_obj.round,
                    "agent": turn.agent,
                    "type": turn.type,
                    "content": turn.content,
                    "evidence": turn.evidence,
                }
                yield f"event: turn\ndata: {llm_client.json.dumps(event_data, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.6)
                turn_index += 1
        
        # Emit synthesis
        synth_data = {
            "core_conflict": debate.synthesis.core_conflict,
            "resolution_suggestion": debate.synthesis.resolution_suggestion,
            "agreement_points": debate.synthesis.agreement_points,
            "divergence_points": debate.synthesis.divergence_points,
        }
        yield f"event: synthesis\ndata: {llm_client.json.dumps(synth_data, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.3)
        
        # Emit done
        done_data = {
            "debate_id": debate.debate_id,
            "space_id": space_id,
            "edge_id": request.edge_id,
            "participants": debate.participants,
            "transcript": [
                {
                    "round": r.round,
                    "turns": [
                        {"round": r.round, "agent": t.agent, "type": t.type, "content": t.content, "evidence": t.evidence}
                        for t in r.turns
                    ],
                }
                for r in debate.transcript
            ],
            "synthesis": synth_data,
        }
        yield f"event: done\ndata: {llm_client.json.dumps(done_data, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Agent Expansion ──

@app.post("/spaces/{space_id}/agents/{agent_id}/expand")
async def expand_agent(space_id: str, agent_id: str, payload: dict):
    """Expand an agent by generating child agents."""
    space = store.get_space(space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")
    
    parent_agent = next((a for a in space.agents if a.agent_id == agent_id), None)
    if not parent_agent:
        raise HTTPException(status_code=404, detail="Agent not found in space")
    
    query_hint = payload.get("query_hint", f"深入探讨 {parent_agent.name} 的观点")
    num_agents = payload.get("num_agents", 2)
    
    system_prompt = f"""你是一位认知空间设计师。基于以下父角色，生成 {num_agents} 个与之相关的子角色。

父角色：{parent_agent.name}（{parent_agent.stance}）
人设：{parent_agent.persona}
核心观点：{parent_agent.summary}

要求：
1. 每个子角色应该是父角色的细化或延伸视角
2. 子角色的立场可以与父角色相同或相反
3. 返回 JSON 数组，字段名为 agents

每个 Agent 字段：
- agent_id: 唯一标识符
- name: 专家名称
- persona: 人物设定
- position: authority（0-1）和 novelty（0-1）
- stance: "pro" / "con" / "neutral"
- confidence: 0-1
- domain: 领域标签
- summary: 核心观点摘要"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"展开方向：{query_hint}"},
    ]
    
    raw = llm_client.chat_completion(messages, json_mode=True)
    data = llm_client.json.loads(raw)
    agents_raw = data.get("agents", [])
    
    new_agents = []
    for idx, a_raw in enumerate(agents_raw):
        child = Agent(
            agent_id=f"agent_{agent_id}_{idx + 1}",
            name=a_raw["name"],
            persona=a_raw.get("persona", ""),
            position=a_raw["position"],
            stance=a_raw["stance"],
            confidence=a_raw.get("confidence", 0.75),
            domain=a_raw.get("domain", parent_agent.domain),
            summary=a_raw.get("summary", ""),
            parent_id=agent_id,
        )
        new_agents.append(child)
    
    space.agents.extend(new_agents)
    store.save_space(space)
    
    return space


@app.post("/auth/logout")
async def auth_logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key=COOKIE_NAME)
    return response
