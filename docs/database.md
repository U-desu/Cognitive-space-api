# 数据库设计文档

> 本文档描述 Cognitive Space API 当前实际落地的数据库配置。
>
> 对应架构版本：微服务 v0.2.0  
> 文档版本：v2.0

---

## 架构总览

```
┌──────────────────────────────────────────────┐
│           单个 PostgreSQL 15 实例             │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Schema: core                            │  │
│  │  spaces, agents, edges, debates         │  │
│  │  trajectories, trajectory_events        │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Schema: auth                            │  │
│  │  users, passwords, oauth_accounts       │  │
│  │  user_spaces                            │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Schema: aggregator (预留)               │  │
│  │  （表结构已定义，当前无数据）             │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**设计原则**：
- **逻辑隔离，物理共享**：各服务通过 PostgreSQL Schema 隔离，共享同一实例
- **微服务边界清晰**：Core 服务只管理 `core` schema，Gateway 只管理 `auth` schema
- **ORM 与 DB 解耦**：ORM 模型不定义跨 schema 的 ForeignKey（避免服务间启动依赖），数据库层面通过独立 SQL 脚本维护 FK 约束
- **Alembic 管理迁移**：所有 schema 变更通过 Alembic 版本控制

---

## 配置方式

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `USE_DB` | `false` | `true`=PostgreSQL, `false`=内存模式 |
| `DATABASE_URL` | `postgresql://localhost:5432/cognitive_space` | PostgreSQL 连接地址 |
| `DB_SCHEMA_CORE` | `core` | Core Service 表所在的 schema |
| `DB_SCHEMA_AUTH` | `auth` | Gateway 认证表所在的 schema |
| `DB_SCHEMA_AGGREGATOR` | `aggregator` | Aggregator 表所在的 schema |

### 切换示例

```bash
# 内存模式（默认，零依赖）
bash scripts/start-services.sh

# PostgreSQL 模式
export USE_DB=true
export DATABASE_URL="postgresql://localhost:5432/cognitive_space"

# Alembic 迁移初始化（推荐）
alembic upgrade head

# 或手动初始化（旧方式，已被 Alembic 替代）
# python3 scripts/init_db.py

bash scripts/start-services.sh
```

---

## Schema: core（Core Service）

### 表清单

| 表名 | 用途 | 数据量预估 |
|------|------|-----------|
| `spaces` | 认知空间定义 | 每个用户 1-10 条 |
| `agents` | 空间中的专家角色 | 每个 space 3-6 条（展开后更多） |
| `edges` | 角色间的冲突边 | 每个 space C(n,2) 条 |
| `debates` | 辩论记录 | 每条 edge 0-1 条 |
| `trajectories` | 认知轨迹主表 | 每个 space 1 条 |
| `trajectory_events` | 轨迹事件（时间序列） | 每个 trajectory 10-100 条 |

### spaces

```sql
CREATE TABLE core.spaces (
    space_id VARCHAR(20) PRIMARY KEY,
    query TEXT NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    user_id VARCHAR(30),                    -- 创建者（null=访客模式）
    created_at TIMESTAMP DEFAULT NOW()
);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `space_id` | VARCHAR(20) | 业务主键，如 `space_a1b2c3d4` |
| `query` | TEXT | 用户输入的问题 |
| `dimensions` | JSONB | 坐标维度定义 |
| `metadata` | JSONB | 空间元数据 |
| `user_id` | VARCHAR(30) | 创建者 ID，null 表示访客创建 |

**约束说明**：
- ORM 层面：`SpaceDB.user_id` 为纯 `String` 列，**无 ForeignKey**（auth 是 Gateway 的职责）
- DB 层面：`scripts/fix_schema.py` 添加了 `FOREIGN KEY (user_id) REFERENCES auth.users(user_id) ON DELETE SET NULL`

### agents

```sql
CREATE TABLE core.agents (
    agent_id VARCHAR(50) NOT NULL,          -- 展开后 ID 可能较长
    space_id VARCHAR(20) NOT NULL REFERENCES core.spaces(space_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    persona TEXT,
    domain VARCHAR(50),
    summary TEXT,
    stance VARCHAR(20),
    confidence FLOAT,
    authority FLOAT,
    novelty FLOAT,
    parent_id VARCHAR(50),                  -- 父 Agent ID（展开生成时使用）
    embedding FLOAT[],                      -- 语义向量
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (space_id, agent_id)
);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `agent_id` | VARCHAR(50) | 业务主键，如 `agent_001` 或 `agent_001_child_abcd` |
| `space_id` | VARCHAR(20) | 所属 space（复合 PK + FK） |
| `name` | VARCHAR(100) | 专家名称 |
| `persona` | TEXT | 人物设定 |
| `domain` | VARCHAR(50) | 领域标签 |
| `summary` | TEXT | 核心观点摘要 |
| `stance` | VARCHAR(20) | `pro` / `con` / `neutral` |
| `confidence` | FLOAT | 自信度 0-1 |
| `authority` | FLOAT | 权威度坐标 0-1 |
| `novelty` | FLOAT | 创新度坐标 0-1 |
| `parent_id` | VARCHAR(50) | 父 Agent ID，表示由该 Agent 展开生成 |
| `embedding` | FLOAT[] | 语义向量数组（mock=37维, local=384, openai=1536） |

**约束说明**：
- `parent_id` 为自引用外键：`REFERENCES core.agents(agent_id) ON DELETE SET NULL`
- 历史上 `agent_id` 为 `VARCHAR(20)`，Agent 展开功能引入后升级为 `VARCHAR(50)`

### edges

```sql
CREATE TABLE core.edges (
    edge_id VARCHAR(50) NOT NULL,
    space_id VARCHAR(20) NOT NULL REFERENCES core.spaces(space_id) ON DELETE CASCADE,
    source_agent_id VARCHAR(50) NOT NULL,
    target_agent_id VARCHAR(50) NOT NULL,
    conflict_score FLOAT NOT NULL,
    conflict_type VARCHAR(20),
    shared_ground TEXT[],
    divergence_axes JSONB,
    debate_recommended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (space_id, edge_id)
);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `edge_id` | VARCHAR(50) | 如 `edge_agent_001_agent_002` |
| `source_agent_id` | VARCHAR(50) | 冲突源 agent |
| `target_agent_id` | VARCHAR(50) | 冲突目标 agent |
| `conflict_score` | FLOAT | 冲突强度 0-2 |
| `conflict_type` | VARCHAR(20) | `fundamental` / `partial` / `minor` |
| `shared_ground` | TEXT[] | 共识点数组 |
| `divergence_axes` | JSONB | 分歧轴列表 |
| `debate_recommended` | BOOLEAN | 是否推荐辩论 |

**约束说明**：
- `space_id` + `source_agent_id` + `target_agent_id` 复合外键到 `core.agents`，带 `ON DELETE CASCADE`

### debates

```sql
CREATE TABLE core.debates (
    debate_id VARCHAR(20) PRIMARY KEY,
    space_id VARCHAR(20) NOT NULL REFERENCES core.spaces(space_id) ON DELETE CASCADE,
    edge_id VARCHAR(50) NOT NULL REFERENCES core.edges(edge_id) ON DELETE CASCADE,
    participants TEXT[] NOT NULL,
    transcript JSONB NOT NULL,
    synthesis JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `transcript` | JSONB | 辩论逐字稿（round/turn 嵌套结构） |
| `synthesis` | JSONB | 合成结果（core_conflict, agreement_points 等） |

**约束说明**：
- `edge_id` 外键到 `core.edges(edge_id) ON DELETE CASCADE`

### trajectories

```sql
CREATE TABLE core.trajectories (
    trajectory_id VARCHAR(20) PRIMARY KEY,
    space_id VARCHAR(20) NOT NULL UNIQUE REFERENCES core.spaces(space_id) ON DELETE CASCADE,
    path JSONB NOT NULL DEFAULT '[]',
    cognitive_metrics JSONB NOT NULL DEFAULT '{}',
    journey_stage VARCHAR(50) DEFAULT 'exploration',
    suggested_next JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### trajectory_events

```sql
CREATE TABLE core.trajectory_events (
    event_id SERIAL PRIMARY KEY,
    trajectory_id VARCHAR(20) NOT NULL REFERENCES core.trajectories(trajectory_id) ON DELETE CASCADE,
    node VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    dwell_time INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `node` | VARCHAR(50) | 用户交互的节点（agent_id 或 edge_id） |
| `action` | VARCHAR(50) | 动作类型：`view_agent`, `debate`, `dwell` 等 |
| `dwell_time` | INTEGER | 停留时间（秒） |

**未来升级**：数据量 > 10万条时，可迁移到 TimescaleDB（PostgreSQL 扩展，零代码改动）。

---

## Schema: auth（Gateway 认证）

### 表清单

| 表名 | 用途 |
|------|------|
| `users` | 注册用户基础信息 |
| `passwords` | bcrypt 密码哈希 |
| `oauth_accounts` | GitHub 等第三方 OAuth 绑定 |
| `user_spaces` | 用户与空间的关联关系 |

### users

```sql
CREATE TABLE auth.users (
    user_id VARCHAR(30) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200),
    avatar TEXT,
    auth_provider VARCHAR(20) DEFAULT 'password',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### passwords

```sql
CREATE TABLE auth.passwords (
    user_id VARCHAR(30) PRIMARY KEY REFERENCES auth.users(user_id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL
);
```

### oauth_accounts

```sql
CREATE TABLE auth.oauth_accounts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(30) NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    provider_account_id VARCHAR(100) UNIQUE NOT NULL
);
```

### user_spaces

```sql
CREATE TABLE auth.user_spaces (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(30) NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    space_id VARCHAR(20) NOT NULL,
    UNIQUE (user_id, space_id)
);
```

**约束说明**：
- ORM 层面：`UserSpaceDB.space_id` 为纯 `String` 列，**无 ForeignKey**（`core.spaces` 属于 Core 服务）
- DB 层面：`scripts/fix_schema.py` 添加了 `FOREIGN KEY (space_id) REFERENCES core.spaces(space_id) ON DELETE CASCADE`
- DB 层面：`UNIQUE (user_id, space_id)` 防止重复关联

---

## Schema: aggregator（预留）

当前 Aggregator Service 使用内存 mock 数据，Schema 已创建但表为空。

预留表结构：

```sql
-- 外部用户（知乎大V等）
CREATE TABLE aggregator.external_users (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(20),
    name VARCHAR(200),
    avatar TEXT,
    title TEXT,
    followers VARCHAR(50),
    url TEXT,
    domain VARCHAR(50),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 外部问题
CREATE TABLE aggregator.external_questions (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(20),
    title TEXT,
    url TEXT,
    views VARCHAR(50),
    domain VARCHAR(50),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 运营预设（热门问题等）
CREATE TABLE aggregator.presets (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50),
    icon_type VARCHAR(50),
    label VARCHAR(100),
    text TEXT,
    color VARCHAR(20),
    "order" INTEGER
);
```

---

## 数据库约束修复

项目初期通过 `scripts/fix_schema.py` 补全了以下约束：

| 表 | 约束 | 行为 |
|----|------|------|
| `core.edges` | 复合 FK → `core.agents` | `ON DELETE CASCADE` |
| `core.agents` | 自引用 FK (`parent_id`) | `ON DELETE SET NULL` |
| `core.spaces` | FK (`user_id`) → `auth.users` | `ON DELETE SET NULL` |
| `core.debates` | FK (`edge_id`) → `core.edges` | `ON DELETE CASCADE` |
| `auth.user_spaces` | FK (`space_id`) → `core.spaces` | `ON DELETE CASCADE` |
| `auth.user_spaces` | `UNIQUE(user_id, space_id)` | 防止重复 |

---

## 代码层映射

### 存储分发（USE_DB 开关）

```
services/core/store.py
├── USE_DB=false → memory_store.py（内存字典）
└── USE_DB=true  → db_store.py（SQLAlchemy + PostgreSQL）

services/gateway/auth/store.py
├── USE_DB=false → memory_store.py（内存字典）
└── USE_DB=true  → db_store.py（SQLAlchemy + PostgreSQL）
```

### 模型定义

```
services/core/models_db.py          → Core schema ORM 模型
services/gateway/auth/models_db.py  → Auth schema ORM 模型
services/shared/db_config.py        → 引擎、Session、Base 定义
```

---

## Alembic 迁移

所有数据库变更通过 Alembic 管理。

```bash
# 升级到最新版本
alembic upgrade head

# 查看当前版本
alembic current

# 创建新迁移（修改 ORM 模型后）
alembic revision --autogenerate -m "description"

# 回滚一次迁移
alembic downgrade -1

# 查看历史
alembic history
```

**配置**：`alembic/env.py` 已配置为支持多 schema PostgreSQL：
- `target_metadata = [CoreBase.metadata, AuthBase.metadata]`
- `include_object` 过滤无 schema 的表（避免 Alembic 内部表干扰）

---

## 性能考量

| 项目 | 当前配置 | 说明 |
|------|----------|------|
| 连接池 | `pool_size=3`, `max_overflow=0` | 单机演示，最小连接数 |
| 驱动 | `psycopg` (psycopg3) | PostgreSQL 官方同步驱动 |
| 索引 | 主键 + 外键 + UNIQUE | 当前数据量小，无需额外索引 |
| 向量 | `FLOAT[]` 数组 | 未来大规模语义搜索可迁移到 pgvector 专用索引 |

---

## 未来拆分路径

```
Phase 1（当前）: 1 PG 实例，3 个 Schema
       │
       ▼  Core Service 数据量/压力激增
Phase 2: Core schema 拆出独立 PG 实例
       │  改 Core Service 的 DATABASE_URL 即可
       │
       ▼  Trajectory 事件数据量激增
Phase 3: trajectory_events 迁移到 TimescaleDB
       │  零代码改动（兼容 PostgreSQL 协议）
       │
       ▼  语义搜索需求增强
Phase 4: embedding 使用 pgvector HNSW 索引
       │  或迁移到专用向量库（Milvus/Pinecone）
       │
       ▼  Generator 缓存需求
Phase 5: 启用 Redis（USE_REDIS=true）
       │  debate / agent 结果缓存
       │
       ▼  Aggregator 数据复杂化
Phase 6: 启用 MongoDB 或 PostgreSQL JSONB 全文搜索
```

---

## 相关文档

- [`docs/database-selection.md`](database-selection.md) — 选型分析（PostgreSQL vs MySQL vs MongoDB）
- [`docs/database-migration-plan.md`](database-migration-plan.md) — 完整的 12 张表迁移方案
