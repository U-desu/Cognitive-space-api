# 认知空间系统 —— 完整逻辑链路梳理

## 0. 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React + Three.js)                     │
│                              http://localhost:5173                           │
│                                                                              │
│  LandingPage ──► SpacePage ──► UniverseScene (3D) + AgentPanel (详情面板)   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ Vite proxy
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                              Gateway (FastAPI)                               │
│                              http://localhost:8000                           │
│                                                                              │
│  职责：认证(JWT Cookie)、API 编排、请求路由到下游微服务                        │
└──────────┬──────────┬──────────┬──────────┬─────────────────────────────────┘
           │          │          │          │
           ▼          ▼          ▼          ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
    │  Core   │ │Generator│ │ Compute │ │Aggregator│
    │ (8001)  │ │ (8002)  │ │ (8003)  │ │ (8004)  │
    │ 数据存储 │ │ LLM生成  │ │ 边计算   │ │ 外部数据  │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

---

## 1. 主链路：用户输入问题 → 3D 认知空间展示

### Step 1：LandingPage 捕获输入

**文件**：`frontend/src/components/LandingPage.tsx`

```
用户输入 query（或点击热门问题卡片）
  ──► handleSubmit()
      ──► api.createSpace({ query, user_context: {} })
          POST /spaces （经过 Vite proxy → Gateway:8000）
      ──► dispatch({ type: 'SET_SPACE', payload: space })
      ──► navigate(`/space/${space.space_id}`)
```

- 强制显示 **LoadingBunny** 动画至少 2200ms
- `hotQuestions` 通过 `api.getHotQuestions()` 从 Aggregator 获取

---

### Step 2：Gateway 编排创建 Space

**文件**：`services/gateway/main.py`

```
Frontend POST /spaces {query}
  ──► require_user (JWT Cookie 认证)
      ──► 1. Generator Service POST /generator/agents/generate
          │    {query, user_context}
          │    ──► LLM 生成 3-5 个 Agent（立场/领域/人格不同）
          │    ◄── 返回 GenerateAgentsResponse {agents: [...]}
          │
      ──► 2. Gateway 构造 Space 对象
          │    - space_id = "space_" + uuid hex
          │    - dimensions: {x: authority, y: novelty}
          │    - agents: 生成的 agents（position 为占位符 {0.5, 0.5}）
          │    - metadata: {space_type, complexity, estimated_nodes}
          │    - user_id: 从 JWT token 中提取
          │
      ──► 3. Core Service POST /spaces/ingest
          │    {完整 Space JSON}
          │    ──► store.save_space(space) → PostgreSQL / 内存
          │
      ──► 4. link_space_to_user(user_id, space_id)
          ◄── 返回 Space 对象给前端
```

**关键**：所有下游调用通过 `_post()` / `_get()` 完成，每次新建 `httpx.AsyncClient`（无连接池）。

---

### Step 3：SpacePage 加载并计算 Edge

**文件**：`frontend/src/components/SpacePage.tsx`

```
路由 /space/:spaceId
  ──► useEffect (spaceId 变化时)
      ──► api.getSpace(spaceId)
          GET /spaces/{space_id} → Gateway → Core
      ──► api.computeEdges(spaceId)
          POST /spaces/{space_id}/edges → Gateway 编排
      ──► api.getTrajectory(spaceId)
          GET /spaces/{space_id}/trajectory → Gateway 编排
      ──► dispatch SET_SPACE / SET_EDGES / SET_TRAJECTORY
```

---

### Step 4：Gateway 编排计算 Edge

**文件**：`services/gateway/main.py`

```
Frontend POST /spaces/{id}/edges
  ──► 1. Compute Service POST /compute/edges/compute
      │    {space_id}
      │    ──► a. 从 Core GET /spaces/{id} 获取完整 Space
      │    ──► b. 生成 embedding:
      │         texts = [f"{name}: {summary} {persona}"]
      │         embedder: local / openai / mock (由 COMPUTE_EMBED_BACKEND 决定)
      │    ──► c. 计算每对 Agent 的 cosine distance
      │    ──► d. 分类冲突:
      │         > 0.7 → fundamental (debate_recommended=true)
      │         > 0.3 → partial
      │         ≤ 0.3 → minor
      │    ──► e. 构建 Edge 对象 + SpaceStats
      │    ◄── 返回 {edges, space_stats}
      │
  ──► 2. Core Service POST /spaces/{id}/edges
      │    {edges: [...]}
      │    ──► store.save_edges(space_id, edges)
      ◄── 返回 {edges, space_stats} 给前端
```

---

### Step 5：UniverseScene 3D 渲染

**文件**：`frontend/src/scene/UniverseScene.tsx`

```
SpaceContext.state.space
  ──► useLayout3D(agents)     → 计算确定性 3D 坐标
  ──► useChildrenMap(agents)  → 构建父子关系映射
  ──► Canvas (@react-three/fiber)
      ├─ Center node (space.query 标签)
      ├─ NodeMesh[] (每个 Agent → 球体 + 立场颜色 + 标签)
      ├─ ConnectionLine[] (parent→child 虚线)
      ├─ ConnectionLine[] (root→center 实线，立场色)
      └─ CameraRig (OrbitControls + 聚焦飞行动画)
```

**布局算法**（`useLayout3D.ts`）：
- Root agents（无 parent_id）：半径 45 的球面内随机分布
- Child agents：围绕 parent，半径 `18 * 0.7^depth`
- 位置通过 `agent_id` hash 种子确定，重渲染稳定

**高亮逻辑**（最新修改）：
- **聚焦（selectedAgent）**：选中节点 + 直接 parent + 直接 children 的节点发光（`emissiveIntensity=1.0`），边不高亮
- **悬浮（hover）**：节点不通过 `isNetworkHighlighted` 发光，仅直接相连的边高亮（无级联传播）

---

## 2. 交互子链路

### 2.1 Agent 点击 → 聚焦视图

```
User clicks NodeMesh
  ──► NodeMesh onClick → UniverseScene onAgentClick prop
      ──► SpacePage handleAgentClick(agentId)
          ──► setSelectedAgent(agentId)
          ──► setViewMode('focus')
          ──► 渲染 AgentPanel（滑出详情面板）
              ├─ Profile 页：Agent 详情 + 冲突排行榜 + Expand 输入
              ├─ Debate 页：SSE 流式辩论
              └─ Cluster 页：知乎外部数据（users + questions）
```

---

### 2.2 Expand Agent → 追加子节点

```
User clicks 🔍（或 AgentPanel Expand 按钮）
  ──► api.expandAgent(spaceId, agentId, { query_hint, num_agents: 2 })
      POST /spaces/{id}/agents/{aid}/expand
      ──► Gateway:
          1. Core GET /spaces/{id} → Space
          2. Generator POST /generator/agents/expand
             {parent_agent, query_hint, num_agents}
             ──► 生成 child agents（parent_id = parent.agent_id）
          3. Core POST /spaces/{id}/agents
             ──► 去重后追加到 Space
          4. Compute POST /compute/edges/compute
             ──► 全量重新计算所有 Edge
          5. Core POST /spaces/{id}/edges
             ──► 覆盖保存新 Edge
          ◄── 返回更新后的 Space
      ──► 前端: dispatch APPEND_AGENTS（只追加新 agents，保留已有 edges/trajectory）
      ──► UniverseScene 重新渲染，新节点出现
```

---

### 2.3 触发辩论（Debate）

#### 同步模式（已少用）
```
POST /spaces/{id}/debates
  ──► Gateway:
      1. Core GET /spaces/{id} + GET /edges/{edge_id}
      2. Generator POST /generator/debates/generate
         ──► 结构化 LLM chain，返回完整 Debate
      3. Core POST /debates/ingest → 存储 Debate
      4. 记录 Trajectory + 计算 Metrics
      ◄── 返回 Debate
```

#### 流式模式（当前使用）
```
POST /spaces/{id}/debates/stream
  ──► Gateway:
      1. Core GET /spaces/{id} + GET /edges/{edge_id}
      2. Generator POST /generator/debates/generate-stream
         ──► 多 Agent state machine，逐轮生成
         ──► SSE event: turn → turn → ... → synthesis → done
      3. Gateway 直接代理 SSE 字节流给前端
      ◄── text/event-stream（不存储）

前端 useDebateStream:
  ──► fetch() + ReadableStream 手动解析 SSE
  ──► 逐行解析 event: turn|synthesis|done
  ──► StreamTurnCard 渲染（打字机效果）
```

---

## 3. 认证链路

```
Frontend (AuthProvider)
  ──► 页面加载时调用 api.getMe()
      GET /auth/me
      ──► Gateway: get_current_user (读取 access_token Cookie)
          ──► 解码 JWT → 返回 user 或 null
      ◄── 返回 {user: User | null}

登录方式:
  A. 密码登录: POST /auth/login → bcrypt 验证 → 设置 JWT Cookie
  B. GitHub OAuth: GET /auth/github/authorize → 回调 → 设置 JWT Cookie
  C. Guest fallback: getMe() 失败时前端创建假用户（始终可用）

受保护端点:
  ──► require_user 依赖项
      ──► 无 Cookie 或无效 JWT → 401 Unauthorized
```

**Cookie 配置**：
- `httponly=True`, `secure=False`, `samesite=lax`, `max_age=7天`
- `JWT_SECRET_KEY` 默认 `dev-secret-change-in-production`

---

## 4. 数据存储链路

### Core Service 存储分发器

**文件**：`services/core/store.py`

```
USE_DB=true  →  从 db_store 导入 (PostgreSQL + SQLAlchemy)
USE_DB=false →  从 memory_store 导入 (Python dict，进程内)
```

**当前环境**：`.env` 中有 `USE_DB=true`，使用 PostgreSQL。

**Schema: core**
- `spaces` — Space 主表（JSONB dimensions/metadata）
- `agents` — Agent 表（含 parent_id, embedding 数组）
- `edges` — Edge 表（source/target FK 到 agents）
- `debates` — 辩论表（JSONB transcript/synthesis）
- `trajectories` — 轨迹表（JSONB path/metrics）
- `trajectory_events` — 事件表

**Schema: auth**
- `users`, `passwords`, `oauth_accounts`, `user_spaces`

---

## 5. 关键问题与风险点

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| 1 | **无连接池** | 每次下游调用新建 `httpx.AsyncClient`，高并发下端口耗尽 | Gateway `_post` / `_get` |
| 2 | **Duplicate trajectory** | `create_debate` 中同一 action 被记录两次 | Gateway `main.py` step 7 & 10 |
| 3 | **Edge update 未持久化** | 辩论后 `shared_ground` / `divergence_axes` 只在 Gateway 内存更新，未回写 Core | Gateway `main.py` |
| 4 | **Stream debate 不存储** | 流式辩论结果不保存，前端需自行处理 | Gateway `create_debate_stream` |
| 5 | **JWT secure=False** | Cookie 在非 HTTPS 环境传输，生产环境不安全 | `auth/jwt.py` |
| 6 | **Position 占位符** | Agent 生成时 authority/novelty 都是 0.5，前端全权负责布局 | Generator / Gateway |
| 7 | **Auth 代码重复** | `get_current_user` / `require_user` 在 `jwt.py` 和 `dependencies.py` 中各有一份，后者实际生效 | Gateway auth |
| 8 | **数据库 schema 漂移** | `parent_id` 列曾缺失导致 500，需确保 `init_db.py` 在启动时运行 | `core/models_db.py` |
