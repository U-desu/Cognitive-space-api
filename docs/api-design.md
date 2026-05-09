# Cognitive Space API 设计文档（v3）

> 本文档描述 Gateway 层对外暴露的完整 API 设计。  
> 所有请求通过 `http://localhost:8000`（Gateway）统一入口。  
> 对应架构版本：微服务 v0.2.0

---

## 核心概念

```
┌─────────────────────────────────────────┐
│           🧠 认知空间（Cognitive Space）   │
│                                         │
│     novelty/diversity (Y轴)             │
│         ↑                               │
│    ● AI创业者(0.8, 0.9)                 │
│         │    ╲ 冲突边                    │
│    ●投资人(0.7,0.6) ───── ● 大厂高管     │
│         │              (0.9, 0.3)        │
│         └────────→ authority (X轴)      │
│                                         │
│    用户轨迹: ──→──→──→                  │
│    认知扩展指数 = 轨迹覆盖面积             │
└─────────────────────────────────────────┘
```

---

## 认证

### 认证方式

| 方式 | 说明 |
|------|------|
| **密码** | `POST /auth/register` + `POST /auth/login`，返回 JWT httpOnly Cookie |
| **GitHub OAuth** | `GET /auth/github/authorize` → 授权 → 回调自动设置 Cookie |
| **访客** | 不调用任何认证端点，直接访问核心 API |

### Cookie 机制

前端请求需携带 `credentials: 'include'`，浏览器自动发送 `access_token` Cookie。

### 端点认证策略

| 端点 | 策略 | 说明 |
|------|------|------|
| `POST /spaces` | 可选 | 访客可创建，登录后自动关联 user_id |
| `POST /spaces/{id}/edges` | 可选 | 访客可计算 |
| `POST /spaces/{id}/debates` | 可选 | 访客可触发辩论 |
| `POST /spaces/{id}/agents/{id}/expand` | 可选 | 访客可展开 |
| `GET /spaces/{id}/trajectory` | 可选 | 访客可查看轨迹 |
| `POST /spaces/{id}/export` | 可选 | 访客可导出 |
| `GET /spaces/my` | **必须登录** | 返回 401 如果未登录 |
| `DELETE /spaces/{id}` | **必须登录** | 返回 401 如果未登录 |

---

## 数据模型

### Agent（认知节点）

```json
{
  "agent_id": "agent_001",
  "name": "AI创业者",
  "persona": "连续创业者，窗口期敏感",
  "position": {
    "authority": 0.75,
    "novelty": 0.92
  },
  "stance": "pro",
  "confidence": 0.85,
  "domain": "startup",
  "summary": "窗口期有限，AI基础设施已成熟",
  "parent_id": null
}
```

### Edge（认知冲突边）

```json
{
  "edge_id": "edge_agent_001_agent_002",
  "source": "agent_001",
  "target": "agent_002",
  "conflict_score": 0.84,
  "conflict_type": "fundamental",
  "shared_ground": ["AI是趋势", "需要准备"],
  "divergence_axes": [
    {"axis": "时机判断", "a_stance": "现在", "b_stance": "再等等"},
    {"axis": "风险偏好", "a_stance": "高风险高回报", "b_stance": "稳健积累"}
  ],
  "debate_recommended": true
}
```

### Space（认知空间）

```json
{
  "space_id": "space_abc123",
  "query": "我是否应该从大厂离职去做AI创业？",
  "dimensions": {
    "x": {"name": "authority", "label": "权威度", "range": [0, 1]},
    "y": {"name": "novelty", "label": "创新度", "range": [0, 1]}
  },
  "agents": [...],
  "metadata": {
    "space_type": "career_decision",
    "complexity": "high",
    "estimated_nodes": 5
  },
  "user_id": null
}
```

### Trajectory（用户认知轨迹）

```json
{
  "trajectory_id": "traj_space_abc123",
  "space_id": "space_abc123",
  "path": [
    {"node": "agent_001", "timestamp": 0, "action": "view", "dwell_time": 8},
    {"node": "agent_003", "timestamp": 12, "action": "expand", "dwell_time": 15},
    {"node": "edge_agent_001_agent_002", "timestamp": 32, "action": "debate", "dwell_time": 45}
  ],
  "cognitive_metrics": {
    "coverage_area": 0.47,
    "depth_score": 0.73,
    "breadth_score": 0.65,
    "conflict_engagement": 0.84
  },
  "journey_stage": "conflict_resolution",
  "suggested_next": {
    "action": "view_synthesis",
    "reason": "你已经看过冲突双方，建议查看共识总结"
  }
}
```

---

## API 端点

### 1. 认证

#### `POST /auth/register` — 注册

**输入**：
```json
{
  "username": "testuser",
  "password": "123456",
  "email": "test@example.com"
}
```

**输出**：
```json
{
  "user": {
    "user_id": "usr_a1b2c3d4e5f6",
    "username": "testuser",
    "email": "test@example.com",
    "avatar": null,
    "auth_provider": "password",
    "created_at": 1704067200
  }
}
```

**副作用**：自动设置 `access_token` Cookie（等同于登录）。

#### `POST /auth/login` — 登录

**输入**：
```json
{
  "username": "testuser",
  "password": "123456"
}
```

**输出**：同注册响应。

**副作用**：设置 `access_token` Cookie。

#### `GET /auth/me` — 获取当前用户

**输出**（已登录）：
```json
{
  "user": {
    "user_id": "usr_a1b2c3d4e5f6",
    "username": "testuser",
    ...
  }
}
```

**输出**（未登录/访客）：
```json
{"user": null}
```

#### `POST /auth/logout` — 登出

**输出**：
```json
{"message": "Logged out"}
```

**副作用**：清除 `access_token` Cookie。

#### `GET /auth/github/authorize` — GitHub OAuth 授权 URL

**输出**：
```json
{"url": "https://github.com/login/oauth/authorize?client_id=...&redirect_uri=..."}
```

#### `GET /auth/github/callback` — GitHub OAuth 回调

**参数**：`?code=xxx`

**行为**：用 code 换 token → 获取 GitHub 用户信息 → 查找/创建本地 User → 设置 Cookie → 重定向到 `/`。

---

### 2. Space

#### `POST /spaces` — 创建认知空间

**输入**：
```json
{
  "query": "我是否应该从大厂离职去做AI创业？",
  "user_context": {
    "industry": "tech",
    "seniority": "5y"
  }
}
```

**输出**：完整 `Space` 对象（含自动生成 agents）。

**行为**：Gateway 编排 → 调用 Generator 生成 Agents → 存入 Core。

#### `GET /spaces/{space_id}` — 获取 Space

**输出**：完整 `Space` 对象（含 agents）。

#### `GET /spaces` — 列出所有 Space

**输出**：`Space[]`

#### `GET /spaces/my` — 获取当前用户的 Space 列表

**认证**：必须登录。

**输出**：`Space[]`

#### `DELETE /spaces/{space_id}` — 删除 Space

**认证**：必须登录。

**输出**：
```json
{"message": "Space deleted", "space_id": "space_abc123"}
```

**行为**：级联删除 agents、edges、debates、trajectories。

---

### 3. Edge

#### `POST /spaces/{space_id}/edges` — 计算并存储冲突边

**输出**：
```json
{
  "edges": [...],
  "space_stats": {
    "conflict_density": 0.63,
    "consensus_clusters": 1,
    "diversity_index": 0.71
  }
}
```

**行为**：Gateway 编排 → 调用 Compute 计算 edges → 存入 Core。

#### `GET /spaces/{space_id}/edges/{edge_id}` — 获取单条 Edge

**输出**：`Edge` 对象。

---

### 4. Debate

#### `POST /spaces/{space_id}/debates` — 触发同步辩论

**输入**：
```json
{
  "edge_id": "edge_agent_001_agent_002",
  "rounds": 2,
  "focus_axes": ["时机判断", "风险偏好"]
}
```

**输出**：完整 `Debate` 对象。

**行为**：Gateway 编排 → 调用 Generator → 存入 Core → 记录 Trajectory → 计算 Metrics。

#### `POST /spaces/{space_id}/debates/stream` — 触发流式辩论（SSE）

**输入**：同同步辩论。

**响应**：`text/event-stream`

**事件流**：
```
event: turn
data: {"round": 1, "agent": "agent_001", "type": "argument", "content": "...", "evidence": []}

event: turn
data: {"round": 1, "agent": "agent_002", "type": "rebuttal", "content": "...", "evidence": []}

event: synthesis
data: {"core_conflict": "...", "resolution_suggestion": "...", ...}

event: done
data: {"debate_id": "...", "transcript": [...], "synthesis": {...}}
```

---

### 5. Agent 展开

#### `POST /spaces/{space_id}/agents/{agent_id}/expand` — 展开 Agent

**输入**：
```json
{
  "query_hint": "深入探讨 AI创业者的观点",
  "num_agents": 2
}
```

**输出**：更新后的 `Space` 对象（含新增 agents）。

**行为**：
1. 从 Core 获取 Space 和父 Agent
2. 调用 Generator 生成子 Agents
3. 追加到 Core
4. 重新计算 Edges

---

### 6. Trajectory

#### `GET /spaces/{space_id}/trajectory` — 获取认知轨迹

**输出**：`Trajectory` 对象（不存在则自动初始化）。

---

### 7. Export

#### `POST /spaces/{space_id}/export` — 导出

**输入**：
```json
{
  "format": "shareable_card",
  "include_trajectory": false
}
```

**输出**（`shareable_card`）：
```json
{
  "export_id": "export_space_abc123",
  "share_url": "https://cognitive.space/s/space_abc123",
  "card_preview": {
    "title": "我的认知探索：离职创业？",
    "summary": "探索了3个视角，参与了1场辩论，认知扩展指数 +47%",
    "space_snapshot": {
      "agents_count": 3,
      "debates_count": 1,
      "coverage_area": 0.47
    }
  }
}
```

**输出**（`json`）：
```json
{
  "space": {...},
  "edges": [...],
  "trajectory": {...}  // 若 include_trajectory=true
}
```

---

### 8. Aggregator（外部数据）

#### `GET /aggregator/zhihu/users?domain={domain}` — 知乎用户

#### `GET /aggregator/zhihu/questions?query={query}` — 知乎问题

#### `GET /aggregator/presets/hot-questions` — 热门问题预设

#### `GET /aggregator/domain-labels` — 领域标签

---

## 错误码

| HTTP 状态 | 场景 | 响应体 |
|-----------|------|--------|
| `200` | 成功 | 正常数据 |
| `400` | 参数错误 | `{"detail": "..."}` |
| `401` | 未登录（需认证端点） | `{"detail": "Not authenticated"}` |
| `404` | 资源不存在 | `{"detail": "Space not found"}` |
| `500` | 内部错误 | `{"detail": "..."}` |

---

## 前端可视化映射

| API 数据 | 前端呈现 |
|---------|---------|
| `agents[].position` | 3D 散点图/力导向图中的节点 |
| `edges[].conflict_score` | 节点间连线（粗细=冲突强度，颜色=冲突类型）|
| `trajectory.path` | 用户探索路径记录 |
| `cognitive_metrics.coverage_area` | 轨迹覆盖面积（认知扩展指数）|
| `agents[].parent_id` | 展开层级关系（父子节点连线）|

---

## 相关文档

- [`docs/auth-module.md`](auth-module.md) — 认证模块架构设计
- [`docs/core-module.md`](core-module.md) — Core Service 架构设计
- [`docs/generator.md`](generator.md) — Generator Service 架构设计
- [`docs/compute-module.md`](compute-module.md) — Compute Service 模块说明
