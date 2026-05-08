# Cognitive Space API

融合"认知空间"概念的多智能体辩论与认知扩展系统。

> 传统系统试图消除分歧，而我们把分歧建模成空间结构。

---

## 核心概念

- **Agent（认知节点）**：每个专家视角是一个坐标点 `(authority, novelty)`
- **Edge（冲突边）**：基于 pairwise diversity 的语义距离
- **Trajectory（认知轨迹）**：用户在空间中的探索路径
- **认知扩展指数**：轨迹覆盖面积

---

## 用户行为路径

```
用户输入问题
    │
    ▼
Gateway ──► Generator (生成 Agents) ──► Core (存储 Space)
    │
    ▼
前端展示 Space（全局视图）
    │
    ▼
Gateway ──► Compute (计算 Edges)
    │         ├── 调用 embedder 计算语义向量（local/openai/mock）
    │         └── 计算 cosine distance + 阈值分类
    │
    ▼
Core (存储 Edges)
    │
    ▼
用户点击 Agent，查看冲突排行榜
    │
    ▼
用户触发辩论
    │
    ▼
Gateway ──► Generator (生成 Debate) ──► Core (存储 Debate)
    │
    ▼
Gateway ──► Core (记录 Trajectory Action)
    │
    ▼
Gateway ──► Compute (计算 Metrics)
    │
    ▼
Core (更新 Trajectory)
    │
    ▼
前端展示 Synthesis + Metrics
```

**关键说明**：
- Generator 被调用 **2 次**（生成 Agents、生成 Debate），不是循环调用
- Compute 被调用 **2 次**（计算 Edges、计算 Metrics），相互独立
- Compute 计算 Edges 时**自己计算 embedding**，不再依赖 Generator 的 mock 数据

---

## 系统架构

```
┌─────────────┐      ┌─────────────────────────────────────────────────────────┐
│  Frontend   │─────►│  Gateway (8000)  - API 网关 + 业务编排                   │
│  (port 5173)│      └────────┬────────┬────────┬────────┬────────────────────┘
└─────────────┘               │        │        │        │
                              ▼        ▼        ▼        ▼
                         ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
                         │ Core   │ │Generator│ │Compute │ │Aggregator│
                         │(8001)  │ │(8002)   │ │(8003)  │ │(8004)   │
                         └────────┘ └────────┘ └────────┘ └────────┘
```

### 服务职责

| 服务 | 端口 | 职责 | 数据类型 | 未来数据库 |
|------|------|------|----------|-----------|
| **Gateway** | 8000 | 统一入口、路由转发、**业务编排** | 无状态 | 无 |
| **Core** | 8001 | Space/Agent/Edge/Debate/Trajectory 存储 | 结构化业务数据 | PostgreSQL |
| **Generator** | 8002 | Agent生成、Debate生成、Embedding | LLM 生成内容 | Redis |
| **Compute** | 8003 | Edge冲突计算、Metrics计算 | 纯算法计算，无持久化 | 无 |
| **Aggregator** | 8004 | 知乎用户、知乎问题、热门问题 | 外部聚合数据 | MongoDB/ES |

### 数据分层

```
用户输入 query
    │
    ▼
┌─────────────────┐     ┌─────────────────┐
│  LLM 实时生成    │────►│  Agent 列表      │  ← Generator Service
│  (space_service) │     │  (name/persona/  │     创造性输出，每次新鲜
└─────────────────┘     │   stance/domain) │
                        └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  Embedding API   │  ← Generator Service
                        │  (可缓存)         │     agent_hash → vec
                        └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  算法计算 Edge   │  ← Compute Service
                        │  (cosine dist)   │     纯数学，无 LLM
                        └─────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌─────────────┐         ┌─────────────────┐
            │ 直接展示 Edge │         │ 触发 Debate     │
            │ (冲突排行榜)  │         │                 │
            └─────────────┘         └─────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────┐
                                        │  LLM 实时生成    │  ← Generator Service
                                        │  Debate 内容     │     可短期缓存
                                        │  (transcript/    │
                                        │   synthesis)     │
                                        └─────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────┐
                                        │  用户浏览行为    │  ← Core Service
                                        │  (点击/停留/    │     轨迹记录
                                        │   辩论触发)      │
                                        └─────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────┐
                                        │  算法计算 Metrics│  ← Compute Service
                                        │  (coverage/depth │     纯数学，无 LLM
                                        │  /breadth/      │
                                        │   engagement)   │
                                        └─────────────────┘
```

---

## Quick Start

### 1. 安装依赖

```bash
# 后端
pip install -r requirements.txt

# 前端
cd frontend && npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，设置 OPENAI_API_KEY 或 MOCK_LLM=true
# 设置 COMPUTE_EMBED_BACKEND 选择 embedding 后端（mock/local/openai）
```

### 3. 启动服务

```bash
# 一键启动所有后端服务
bash scripts/start-services.sh

# 或手动启动
python3 -m uvicorn services.core.main:app --port 8001 &
python3 -m uvicorn services.generator.main:app --port 8002 &
python3 -m uvicorn services.compute.main:app --port 8003 &
python3 -m uvicorn services.aggregator.main:app --port 8004 &
python3 -m uvicorn services.gateway.main:app --port 8000 &

# 启动前端
cd frontend && npm run dev
```

访问 http://localhost:5173 即可使用。

### 4. 停止服务

```bash
# 停止所有后端服务
pkill -f 'uvicorn services'

# 停止前端（如果在终端运行，按 Ctrl+C）
# 或查找并终止 node 进程
pkill -f 'vite'
```

### 5. 验证服务

```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```

### 6. API 调用示例

```bash
# 创建认知空间（Gateway 编排：Generator 生成 Agent → Core 存储）
curl -X POST http://localhost:8000/spaces \
  -H "Content-Type: application/json" \
  -d '{"query": "大厂5年了，该辞职去做AI创业吗？"}'

# 计算冲突边（Gateway 编排：Core 读 Space → Compute 计算 → Core 存储）
curl -X POST http://localhost:8000/spaces/{space_id}/edges

# 触发辩论（Gateway 编排：Core 读数据 → Generator 生成 → Core 存储 + 轨迹更新）
curl -X POST http://localhost:8000/spaces/{space_id}/debates \
  -H "Content-Type: application/json" \
  -d '{"edge_id": "edge_agent_001_agent_002", "rounds": 2}'

# 获取认知轨迹（Gateway 编排：Core 读轨迹 → Compute 计算指标）
curl http://localhost:8000/spaces/{space_id}/trajectory

# 获取外部数据（Aggregator）
curl "http://localhost:8000/aggregator/zhihu/users?domain=startup"
curl "http://localhost:8000/aggregator/zhihu/questions?query=大厂创业"
curl http://localhost:8000/aggregator/presets/hot-questions
```

---

## 前端 mock 数据迁移

所有前端业务数据已迁移到后端对应服务：

| 原前端数据 | 迁移目标 | 新 API |
|------------|----------|--------|
| `MOCK_ZHIHU_USERS` | Aggregator Service | `GET /aggregator/zhihu/users?domain={domain}` |
| `PRESET_ZHIHU_QUESTIONS` | Aggregator Service | `GET /aggregator/zhihu/questions?query={query}` |
| `HOT_QUESTIONS` | Aggregator Service | `GET /aggregator/presets/hot-questions` |
| `DOMAIN_LABEL` | Aggregator Service | `GET /aggregator/domain-labels` |
| fallback debate | Generator Service | 内部处理，LLM 失败自动返回 fallback |
| `__user__` 虚拟 agent | **保留在前端** | UI 表示，从 `space.query` 派生，非业务数据 |

**原则**：前端不再保存任何业务数据，所有数据通过 API 从后端获取。

---

## 目录结构

```
cognitive-space-api/
├── services/                    # 微服务目录
│   ├── shared/                  # 共享模型和配置
│   │   ├── models.py            # 所有 Pydantic 模型
│   │   └── config.py            # 服务发现和 LLM 配置
│   │
│   ├── gateway/                 # API 网关 (port 8000)
│   │   └── main.py              # 路由转发 + 业务编排
│   │
│   ├── core/                    # 业务数据服务 (port 8001)
│   │   ├── store.py             # 内存存储（未来替换为 DB）
│   │   └── routers/             # spaces, edges, debates, trajectories, export
│   │
│   ├── generator/               # LLM 生成服务 (port 8002)
│   │   ├── llm_client.py        # OpenAI / Mock 客户端
│   │   ├── mock_data.py         # Mock 角色池、辩论模板
│   │   └── routers/             # agents, debates, embeddings
│   │
│   ├── compute/                 # 计算服务 (port 8003)
│   │   ├── edge_calculator.py   # 冲突边计算
│   │   ├── metrics_calculator.py # 认知指标计算
│   │   └── routers/             # edges, metrics
│   │
│   └── aggregator/              # 三方聚合服务 (port 8004)
│       ├── mock_data.py         # 知乎用户、问题、热门问题
│       └── routers/             # zhihu, presets
│
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── api.ts               # API 客户端（调用 Gateway）
│   │   ├── api-types.ts         # TypeScript 类型定义
│   │   └── components/          # React 组件
│   └── vite.config.ts           # 代理配置指向 Gateway
│
├── scripts/
│   └── start-services.sh        # 一键启动脚本
│
├── docs/
│   ├── api-design.md            # API 完整设计
│   ├── compute-module.md        # Compute 服务模块说明（配置、公式、依据）
│   ├── pitch-script.md          # 5分钟答辩逐句稿
│   └── database-migration-plan.md # 数据库迁移方案（12张表）
│
├── requirements.txt
├── .env
└── README.md
```

---

## 数据库迁移指南

当前所有服务使用内存存储。各服务已按以下策略设计，可独立迁移：

### Core Service → PostgreSQL

| 表 | 结构 | 索引 |
|----|------|------|
| `spaces` | space_id(PK), query, dimensions(JSONB), metadata(JSONB) | PK |
| `agents` | agent_id(PK), space_id(FK), name, persona, stance, domain, summary, position(JSONB) | space_id |
| `edges` | edge_id(PK), space_id(FK), source, target, conflict_score, conflict_type, debate_recommended | space_id, conflict_type |
| `debates` | debate_id(PK), edge_id(FK), participants(JSONB), transcript(JSONB), synthesis(JSONB) | edge_id |
| `trajectories` | trajectory_id(PK), space_id(FK), path(JSONB), metrics(JSONB), journey_stage | space_id |

### Generator Service → Redis

| Key 模式 | 值 | TTL |
|----------|-----|-----|
| `embedding:{text_hash}` | 1536-dim float[] | 永久 |
| `debate:{edge_hash}` | debate JSON | 7 天 |
| `agent:{query_hash}` | agents JSON | 1 小时 |

### Compute Service

- **无状态**，无需数据库
- 水平扩展：直接增加实例

### Aggregator Service → MongoDB / Elasticsearch

| 集合/索引 | 用途 |
|-----------|------|
| `external_users` | 知乎用户文档，按 domain 索引 |
| `external_questions` | 知乎问题文档，支持语义搜索 |
| `presets` | 运营配置（热门问题等） |

---

## 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENAI_API_KEY` | - | OpenAI API 密钥 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 基础地址 |
| `MODEL_NAME` | `gpt-4o-mini` | LLM 模型名称 |
| `EMBED_MODEL` | `text-embedding-3-small` | Embedding 模型名称 |
| `MOCK_LLM` | `false` | 是否使用 mock LLM（无 API key 时设为 true） |
| `COMPUTE_EMBED_BACKEND` | `mock` | Compute embedding 后端：`mock` / `local` / `openai` |
| `COMPUTE_LOCAL_MODEL` | `all-MiniLM-L6-v2` | Local 后端模型名称 |
| `COMPUTE_OPENAI_MODEL` | `text-embedding-3-small` | OpenAI 后端模型名称 |

---

## 文档

- [`docs/api-design.md`](docs/api-design.md) — API 完整设计
- [`docs/pitch-script.md`](docs/pitch-script.md) — 5分钟答辩逐句稿
- [`docs/database-migration-plan.md`](docs/database-migration-plan.md) — PostgreSQL + pgvector 迁移方案（12张表）
- [`docs/compute-module.md`](docs/compute-module.md) — Compute 服务模块说明（配置、公式、依据）

---

## 许可证

MIT
