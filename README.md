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
    │         ├── 调用 embedder 计算语义向量（local / openai / keyword）
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
- Compute 计算 Edges 时**自己计算 embedding**，不再依赖 Generator 的 preset 数据

---

## 系统架构

```
┌─────────────┐      ┌─────────────────────────────────────────────────────────┐
│  Frontend   │─────►│  Gateway (8000)  - API 网关 + 业务编排 + 认证            │
│  (port 5173)│      └────────┬────────┬────────┬────────┬────────────────────┘
└─────────────┘               │        │        │        │
                              ▼        ▼        ▼        ▼
                         ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
                         │ Core   │ │Generator│ │Compute │ │Aggregator│
                         │(8001)  │ │(8002)   │ │(8003)  │ │(8004)   │
                         └────────┘ └────────┘ └────────┘ └────────┘
```

### 服务职责

| 服务 | 端口 | 职责 | 数据类型 | 数据库 |
|------|------|------|----------|--------|
| **Gateway** | 8000 | 统一入口、路由转发、**业务编排**、**认证** | 无状态 | 无（Auth 数据在 PostgreSQL `auth` schema） |
| **Core** | 8001 | Space/Agent/Edge/Debate/Trajectory 存储 | 结构化业务数据 | PostgreSQL `core` schema |
| **Generator** | 8002 | Agent生成、Debate生成、Embedding | LLM 生成内容 | 内存（未来 Redis） |
| **Compute** | 8003 | Edge冲突计算、Metrics计算 | 纯算法计算，无持久化 | 无 |
| **Aggregator** | 8004 | 知乎用户、知乎问题、热门问题 | 外部聚合数据 | 内存（未来 MongoDB/ES） |

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
                        │  Embedding API   │  ← Compute Service
                        │  (可插拔后端)     │     local / openai / keyword
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

## 生产部署（Docker 一键启动）

服务器上只需执行：

```bash
git clone https://github.com/U-desu/Cognitive-space-api.git
cd Cognitive-space-api
./deploy.sh
```

`deploy.sh` 会自动完成：
1. 检查并创建 `.env`（首次运行会提示你配置 API Key）
2. 检查 Docker / Docker Compose 是否安装
3. 构建并启动前后端容器

访问 `http://服务器IP` 即可使用。

### Docker 部署详情

架构：Nginx（前端静态文件 + 反向代理）+ Python All-in-One（5 个微服务）

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   Nginx     │────▶│  Gateway (8000)                          │
│  (port 80)  │     │    ├── Core (8001)                       │
│  静态文件    │     │    ├── Generator (8002) ← 调用 LLM API   │
│  反向代理    │     │    ├── Compute (8003)                    │
│             │     │    └── Aggregator (8004)                 │
└─────────────┘     └──────────────────────────────────────────┘
```

手动操作（如果不使用 `deploy.sh`）：

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，设置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY

# 2. 构建并启动
docker compose up -d --build

# 3. 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 4. 停止
docker compose down
```

**生产环境注意**：
- 务必修改 `.env` 中的 `JWT_SECRET_KEY`
- 如需 HTTPS，在 `frontend/nginx.conf` 中配置 SSL 证书
- 如需数据持久化，设置 `USE_DB=true` 并在 `docker-compose.yml` 中加入 PostgreSQL 服务

---

## 本地开发 Quick Start

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
# 编辑 .env：
# - 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY（）
# - 设置 COMPUTE_EMBED_BACKEND 选择 embedding 后端（keyword / local / openai）
# - 设置 JWT_SECRET_KEY（生产环境必须修改默认值）
# - 可选：设置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 启用 GitHub 登录
```

### 3. 数据库（推荐启用持久化）

系统支持两种存储模式：
- **内存模式**（`USE_DB=false`）：零依赖，重启数据丢失，适合快速演示
- **PostgreSQL 模式**（`USE_DB=true`）：数据持久化，含 Alembic 迁移，适合开发/生产

```bash
# macOS 安装 PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# 创建数据库
createdb cognitive_space

# 初始化 schema + 表（Alembic 迁移）
export USE_DB=true
export DATABASE_URL="postgresql://localhost:5432/cognitive_space"
alembic upgrade head

# 或手动初始化（旧方式，已被 Alembic 替代）
# python3 scripts/init_db.py

# 停止 PostgreSQL
brew services stop postgresql@15
```

### 4. 启动服务

```bash
# 一键启动所有后端服务
bash scripts/start-services.sh

# 或手动启动（端口可通过环境变量覆盖）
python3 -m uvicorn services.core.main:app --port 8001 &
python3 -m uvicorn services.generator.main:app --port 8002 &
python3 -m uvicorn services.compute.main:app --port 8003 &
python3 -m uvicorn services.aggregator.main:app --port 8004 &
python3 -m uvicorn services.gateway.main:app --port 8000 &

# 启动前端
cd frontend && npm run dev
```

访问 http://localhost:5173 即可使用。

### 5. 停止服务

```bash
# 停止所有后端服务
pkill -f 'uvicorn services'

# 停止前端
pkill -f 'vite'

# 停止 PostgreSQL（如已启用）
brew services stop postgresql@15
```

### 6. 验证服务

```bash
# 一键验证（健康检查 + API 流程 + DB 一致性）
python3 scripts/validate.py

# 或手动检查各服务健康
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
```

### 7. 运行测试

```bash
# 集成测试（需要所有服务在线）
python3 -m pytest tests/test_api.py -v

# 或带环境变量运行
USE_DB=true LLM_PROVIDER=deepseek python3 -m pytest tests/test_api.py -v
```

### 8. API 调用示例

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

# 展开 Agent（生成子视角）
curl -X POST http://localhost:8000/spaces/{space_id}/agents/{agent_id}/expand \
  -H "Content-Type: application/json" \
  -d '{"query_hint": "深入探讨", "num_agents": 2}'

# 获取认知轨迹（Gateway 编排：Core 读轨迹 → Compute 计算指标）
curl http://localhost:8000/spaces/{space_id}/trajectory

# 认证示例
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456","email":"test@example.com"}' \
  -c cookies.txt

curl http://localhost:8000/auth/me -b cookies.txt

curl -X POST http://localhost:8000/auth/logout -b cookies.txt

# 获取外部数据（Aggregator）
curl "http://localhost:8000/aggregator/zhihu/users?domain=startup"
curl "http://localhost:8000/aggregator/zhihu/questions?query=大厂创业"
curl http://localhost:8000/aggregator/presets/hot-questions
```

---

## 认证系统

支持三种认证方式，全部兼容访客模式：

| 方式 | 端点 | 说明 |
|------|------|------|
| **密码注册** | `POST /auth/register` | username + password + email |
| **密码登录** | `POST /auth/login` | 返回 JWT httpOnly cookie (`access_token`) |
| **GitHub OAuth** | `GET /auth/github/authorize` → callback | 一键登录，自动创建/绑定用户 |
| **访客模式** | 无需登录 | 可直接创建 Space、计算 Edge、触发 Debate |

所有受保护端点使用 `get_current_user`（可选认证），未登录时以访客身份操作。

---

## 前端静态数据迁移

所有前端业务数据已迁移到后端对应服务：

| 原前端数据 | 迁移目标 | 新 API |
|------------|----------|--------|
| `ZHIHU_USERS` | Aggregator Service | `GET /aggregator/zhihu/users?domain={domain}` |
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
│   ├── shared/                  # 共享模型和配置 SSoT
│   │   ├── models.py            # 所有 Pydantic 模型
│   │   ├── config.py            # 服务发现 + LLM + Auth + Compute 配置
│   │   └── db_config.py         # PostgreSQL 引擎 + Schema 定义
│   │
│   ├── gateway/                 # API 网关 (port 8000)
│   │   ├── auth/                # 认证模块（JWT / OAuth / 密码）
│   │   │   ├── jwt.py
│   │   │   ├── password_auth.py
│   │   │   ├── github_oauth.py
│   │   │   ├── models_db.py     # Auth schema ORM
│   │   │   └── store.py         # 内存/DB 分发
│   │   ├── dependencies.py      # get_current_user / require_user
│   │   └── main.py              # 路由转发 + 业务编排 + 认证路由
│   │
│   ├── core/                    # 业务数据服务 (port 8001)
│   │   ├── models_db.py         # Core schema ORM
│   │   ├── db_store.py          # PostgreSQL CRUD
│   │   ├── memory_store.py      # 内存存储
│   │   ├── store.py             # 内存/DB 分发
│   │   └── routers/             # spaces, edges, debates, trajectories, export
│   │
│   ├── generator/               # LLM 生成服务 (port 8002)
│   │   ├── llm_client.py        # OpenAI / DeepSeek / Mock 客户端
│   │   ├── llm_chain.py         # LangChain 结构化链
│   │   ├── preset_data.py         # Preset 角色池、辩论模板
│   │   └── routers/             # agents, debates, embeddings
│   │
│   ├── compute/                 # 计算服务 (port 8003)
│   │   ├── edge_calculator.py   # 冲突边计算
│   │   ├── metrics_calculator.py # 认知指标计算
│   │   ├── embedder.py          # 可插拔嵌入后端
│   │   └── routers/             # edges, metrics
│   │
│   └── aggregator/              # 三方聚合服务 (port 8004)
│       ├── preset_data.py         # 知乎用户、问题、热门问题（静态数据）
│       └── routers/             # zhihu, presets
│
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── api.ts               # API 客户端（调用 Gateway，自动携带 Cookie）
│   │   ├── api-types.ts         # TypeScript 类型定义
│   │   ├── auth/                # 认证相关组件
│   │   └── components/          # React 组件
│   └── vite.config.ts           # 代理配置指向 Gateway
│
├── tests/
│   └── test_api.py              # 10 个集成测试
│
├── scripts/
│   ├── start-services.sh        # 一键启动脚本
│   ├── validate.py              # 一键验证脚本
│   ├── clean_data.py            # 数据清理脚本
│   ├── fix_schema.py            # DB 约束修复脚本
│   ├── init_db.py               # 数据库初始化（旧方式）
│   └── export-schema.py         # OpenAPI schema 导出
│
├── alembic/                     # Alembic 数据库迁移
│   ├── env.py                   # 多 schema PostgreSQL 配置
│   └── versions/                # 迁移版本
│
├── docs/
│   ├── api-design.md            # API 完整设计
│   ├── auth.md                  # 认证系统设计
│   ├── compute-module.md        # Compute 服务模块说明
│   ├── database.md              # 数据库设计文档
│   ├── database-selection.md    # 数据库选型分析
│   ├── database-migration-plan.md # 迁移方案
│   └── pitch-script.md          # 5分钟答辩逐句稿
│
├── requirements.txt
├── .env.example
└── README.md
```

---

## 数据库迁移指南

系统使用 **Alembic** 管理数据库迁移，支持多 Schema PostgreSQL。

```bash
# 初始化数据库（创建 schema + 表）
alembic upgrade head

# 创建新迁移（修改 models_db.py 后）
alembic revision --autogenerate -m "description"

# 回滚一次迁移
alembic downgrade -1
```

### Core Service → PostgreSQL `core` schema

| 表 | 结构 | 索引 |
|----|------|------|
| `spaces` | space_id(PK), query, dimensions(JSONB), metadata(JSONB), user_id | PK |
| `agents` | agent_id(PK), space_id(FK), name, persona, stance, domain, summary, parent_id | space_id |
| `edges` | edge_id(PK), space_id(FK), source_agent_id, target_agent_id, conflict_score | space_id |
| `debates` | debate_id(PK), space_id(FK), edge_id(FK), participants(JSONB), transcript(JSONB) | edge_id |
| `trajectories` | trajectory_id(PK), space_id(FK,UNIQUE), path(JSONB), metrics(JSONB), journey_stage | space_id |
| `trajectory_events` | event_id(PK), trajectory_id(FK), node, action, dwell_time | trajectory_id |

### Generator Service

- **无持久化数据库**，纯内存 + LLM 实时生成
- 未来可接入 Redis 缓存 debate/agent 结果

### Compute Service

- **无状态**，无需数据库
- 水平扩展：直接增加实例，无需共享存储

### Aggregator Service

- **当前使用内存静态数据**
- 未来可接入 MongoDB / Elasticsearch 存储外部数据

---

## 环境变量说明

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_PROVIDER` | `openai` | LLM 提供商：`openai` / `deepseek` |
| `OPENAI_API_KEY` | - | OpenAI API 密钥 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 基础地址 |
| `DEEPSEEK_API_KEY` | - | DeepSeek API 密钥 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | DeepSeek 基础地址 |
| `MODEL_NAME` | `gpt-4o-mini` | LLM 模型名称 |
| `` | `false` | 已移除，运行时必须配置 LLM API key |
| `COMPUTE_EMBED_BACKEND` | `keyword` | Compute embedding 后端：`keyword` / `local` / `openai` |
| `COMPUTE_LOCAL_MODEL` | `all-MiniLM-L6-v2` | Local 后端模型名称 |
| `COMPUTE_OPENAI_MODEL` | `text-embedding-3-small` | OpenAI 后端模型名称 |
| `USE_DB` | `false` | `true`=PostgreSQL, `false`=内存模式 |
| `DATABASE_URL` | `postgresql://localhost:5432/cognitive_space` | PostgreSQL 连接地址 |
| `JWT_SECRET_KEY` | `dev-secret-change-in-production` | JWT 签名密钥（**生产必须修改**） |
| `JWT_ALGORITHM` | `HS256` | JWT 算法 |
| `JWT_EXPIRE_MINUTES` | `10080` | Token 过期时间（默认 7 天） |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth App Client ID（可选） |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth App Client Secret（可选） |
| `GITHUB_REDIRECT_URI` | `http://localhost:8000/auth/github/callback` | GitHub 回调地址 |

---

## 文档

- [`docs/api-design.md`](docs/api-design.md) — API 完整设计
- [`docs/auth.md`](docs/auth.md) — 认证系统设计（JWT / OAuth / 密码 / 访客兼容）
- [`docs/compute-module.md`](docs/compute-module.md) — Compute 服务模块说明（配置、公式、依据）
- [`docs/database.md`](docs/database.md) — 数据库设计文档（Schema/表结构/配置方式）
- [`docs/database-selection.md`](docs/database-selection.md) — 数据库选型分析（PostgreSQL vs MySQL vs MongoDB）
- [`docs/pitch-script.md`](docs/pitch-script.md) — 5分钟答辩逐句稿
- [`docs/database-migration-plan.md`](docs/database-migration-plan.md) — PostgreSQL + pgvector 迁移方案

---

## 许可证

MIT
