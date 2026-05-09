# 各模块数据库选型方案

> 基于微服务架构的数据存储选型分析，兼顾当前 Demo 落地与未来扩展。

---

## 一、选型总览

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Core Service   │     │ Generator Svc   │     │Aggregator Svc   │
│   (port 8001)   │     │   (port 8002)   │     │  (port 8004)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  PostgreSQL 15+ │     │     Redis 7     │     │   MongoDB 6     │
│  + pgvector     │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │
         ├──► spaces, agents, edges, debates  (关系表)
         ├──► agent_embeddings  (向量表，pgvector)
         ├──► trajectories  (JSONB，未来可切 TimescaleDB)
         └──► external_users, external_questions  (可选共库)
```

| 服务 | 数据库 | 数据类型 | 选型理由 |
|------|--------|----------|----------|
| **Core** | PostgreSQL 15+ + pgvector | 结构化关系数据 + 向量 | 事务、JSONB、向量检索一体化 |
| **Generator** | Redis 7 | 缓存 | 高频读、TTL、轻量 |
| **Compute** | **无** | 纯内存计算 | 无状态，水平扩展 |
| **Aggregator** | MongoDB 6 | 文档型外部数据 | 灵活 Schema、快速迭代 |
| **Gateway** | **无** | 无状态路由 | 无需持久化 |

---

## 二、Core Service → PostgreSQL + pgvector

### 2.1 为什么选 PostgreSQL？

Core 存储 5 种核心实体，它们之间有复杂的关系：

```
Space 1 ──► N Agents
Space 1 ──► N Edges (Agent_A ↔ Agent_B)
Edge 1  ──► 1 Debate
Space 1 ──► 1 Trajectory
```

**关系型数据库是必然选择**，因为：
- 外键约束保证数据一致性（Edge 的 source/target 必须指向存在的 Agent）
- 事务支持（创建 Space 时必须同时创建 Agents，失败回滚）
- JSONB 存储灵活的 dimensions、metadata、transcript
- 成熟稳定的生态，Alembic 迁移管理

**为什么不用 MySQL？**
- PostgreSQL 的 JSONB 性能优于 MySQL 的 JSON
- pgvector 扩展是目前最成熟的向量数据库扩展
- 中文全文搜索（pg_trgm、zhparser）比 MySQL 更完善

### 2.2 为什么向量也放 PostgreSQL？

Compute Service 计算 embedding 后，向量有多个用途：
1. Edge 计算（cosine distance）
2. 未来语义搜索（"找和这位 Agent 观点最相近的人"）
3. 聚类分析（"哪些 Agent 形成了共识群体"）

**方案对比：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| **PostgreSQL + pgvector** | 和 Agent 数据同库，JOIN 方便；事务一致 | 向量检索性能不如专用向量库 |
| Redis Stack (RediSearch) | 内存速度快 | 和 Agent 数据分离，需要双写 |
| 专用向量库 (Milvus/Pinecone) | 性能最强 | 增加运维复杂度 |

**推荐：PostgreSQL + pgvector**。原因：
- 当前规模下（每个 Space 3-6 个 Agent，最多几十条 Edge），pgvector 完全够用
- 向量数据量小（6 agents × 384/1536 维 = 可忽略）
- 避免引入第 4 个数据库组件
- SQL 中直接计算距离：`SELECT 1 - (a.embedding <=> b.embedding)`

### 2.3 表结构设计（基于微服务拆分）

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- 模糊搜索

-- 认知空间
CREATE TABLE spaces (
    space_id VARCHAR(20) PRIMARY KEY,
    query TEXT NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 角色实例
CREATE TABLE agents (
    agent_id VARCHAR(20) NOT NULL,
    space_id VARCHAR(20) NOT NULL REFERENCES spaces(space_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    persona TEXT,
    domain VARCHAR(50),
    summary TEXT,
    stance VARCHAR(20) CHECK (stance IN ('pro', 'con', 'neutral')),
    confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
    authority FLOAT CHECK (authority BETWEEN 0 AND 1),
    novelty FLOAT CHECK (novelty BETWEEN 0 AND 1),
    -- 向量维度根据 backend 动态调整：keyword=39, local=384, openai=1536
    embedding VECTOR(1536),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (space_id, agent_id)
);

CREATE INDEX idx_agents_space ON agents(space_id);
CREATE INDEX idx_agents_domain ON agents(domain);

-- 冲突边
CREATE TABLE edges (
    edge_id VARCHAR(50) NOT NULL,
    space_id VARCHAR(20) NOT NULL REFERENCES spaces(space_id) ON DELETE CASCADE,
    source_agent_id VARCHAR(20) NOT NULL,
    target_agent_id VARCHAR(20) NOT NULL,
    conflict_score FLOAT NOT NULL CHECK (conflict_score BETWEEN 0 AND 2),
    conflict_type VARCHAR(20) CHECK (conflict_type IN ('fundamental', 'partial', 'minor')),
    shared_ground TEXT[],
    divergence_axes JSONB,
    debate_recommended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (space_id, edge_id),
    FOREIGN KEY (space_id, source_agent_id) REFERENCES agents(space_id, agent_id),
    FOREIGN KEY (space_id, target_agent_id) REFERENCES agents(space_id, agent_id)
);

CREATE INDEX idx_edges_space ON edges(space_id);
CREATE INDEX idx_edges_recommended ON edges(space_id, debate_recommended) WHERE debate_recommended = TRUE;

-- 辩论
CREATE TABLE debates (
    debate_id VARCHAR(20) PRIMARY KEY,
    space_id VARCHAR(20) NOT NULL REFERENCES spaces(space_id) ON DELETE CASCADE,
    edge_id VARCHAR(50) NOT NULL,
    participants TEXT[] NOT NULL,
    transcript JSONB NOT NULL,
    synthesis JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (space_id, edge_id) REFERENCES edges(space_id, edge_id)
);

-- 轨迹主表
CREATE TABLE trajectories (
    trajectory_id VARCHAR(20) PRIMARY KEY,
    space_id VARCHAR(20) NOT NULL REFERENCES spaces(space_id) ON DELETE CASCADE,
    cognitive_metrics JSONB NOT NULL DEFAULT '{}',
    journey_stage VARCHAR(50) DEFAULT 'exploration',
    suggested_next JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 轨迹事件（时间序列）
CREATE TABLE trajectory_events (
    event_id SERIAL PRIMARY KEY,
    trajectory_id VARCHAR(20) NOT NULL REFERENCES trajectories(trajectory_id) ON DELETE CASCADE,
    node VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    dwell_time INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_traj ON trajectory_events(trajectory_id);
CREATE INDEX idx_events_time ON trajectory_events(created_at);
```

### 2.4 向量维度兼容策略

不同 embedding backend 产生不同维度的向量：

| Backend | 维度 |
|---------|------|
| keyword | 39 |
| local (all-MiniLM-L6-v2) | 384 |
| openai (text-embedding-3-small) | 1536 |

**方案：统一存储为 1536 维，不足补零**

```python
# 存储时
vec = embedder.embed(text)  # keyword: 39维, local: 384维
padded = vec + [0.0] * (1536 - len(vec))  # 补零到 1536 维

# 查询时（pgvector 的 <=> 操作符）
# 补零后的向量 cosine distance 和原向量相同（零维度不影响点积）
```

**好处**：表结构固定，切换 backend 无需改表。零填充不影响 cosine similarity 计算。

### 2.5 在 SQL 中计算冲突边（替代 Python 循环）

```sql
-- 计算某个 Space 中所有 Agent 对的 cosine distance
SELECT 
    a.agent_id AS source,
    b.agent_id AS target,
    1 - (a.embedding <=> b.embedding) AS conflict_score,
    CASE 
        WHEN 1 - (a.embedding <=> b.embedding) > 0.7 THEN 'fundamental'
        WHEN 1 - (a.embedding <=> b.embedding) > 0.3 THEN 'partial'
        ELSE 'minor'
    END AS conflict_type
FROM agents a
JOIN agents b ON a.space_id = b.space_id AND a.agent_id < b.agent_id
WHERE a.space_id = 'space_xxx';
```

这比 Python 循环快 10-100 倍，且减少了服务间 HTTP 调用。

### 2.6 Trajectory 时间序列处理

当前方案：PostgreSQL JSONB + 普通表

**未来升级路径**：
- 数据量 < 10万条：PostgreSQL JSONB 足够
- 数据量 > 10万条：迁移到 **TimescaleDB**（PostgreSQL 扩展）
- TimescaleDB 是时序专用扩展，兼容 PostgreSQL 协议，零代码改动

---

## 三、Generator Service → Redis

### 3.1 为什么选 Redis？

Generator 的核心需求是**缓存 LLM 生成结果**：

| 缓存类型 | Key 模式 | 值 | TTL | 原因 |
|----------|----------|-----|-----|------|
| Embedding | `emb:{text_hash}` | float[] | 永久 | 同一文本的向量不变 |
| Debate | `deb:{edge_hash}` | JSON | 7 天 | 辩论内容可复用 |
| Agent | `agt:{query_hash}` | JSON | 1 小时 | 同一 query 可能生成不同 agents |

**Redis 是最合适的缓存层**：
- 内存级读取速度（亚毫秒）
- 原生支持 TTL 过期
- 数据结构丰富（String 存 JSON、List 存历史）
- 和 PostgreSQL 完美互补（热数据 Redis、冷数据 PG）

### 3.2 为什么不用 Redis 存 Embedding 向量？

之前考虑过把 embedding 向量放 Redis，但现在 Compute Service 自己计算 embedding（通过 sentence-transformers 或 OpenAI API），向量计算和存储已经解耦：

- **Compute 计算** → 向量在内存中直接使用（计算 Edge）
- **Core 存储** → 向量持久化到 PostgreSQL（供后续语义搜索）
- **Generator 无需缓存 embedding** → 因为 Compute 不再调用 Generator 获取 embedding

### 3.3 Redis 数据结构示例

```
# Debate 缓存
SET debate:edge_agent_001_agent_004 "{...json...}" EX 604800

# Agent 列表缓存（同一 query 的生成结果）
SET agents:query_hash "[{agent1}, {agent2}, ...]" EX 3600

# 限流计数（未来扩展）
INCR rate_limit:ip_xxx
EXPIRE rate_limit:ip_xxx 60
```

---

## 四、Compute Service → 无数据库

### 4.1 为什么不需要数据库？

Compute 是**纯计算服务**，特点是：
- 输入来自 HTTP 请求（Space + Trajectory）
- 输出直接返回（Edges + Metrics）
- 计算结果由调用方（Gateway）决定存储与否
- 无会话状态、无用户上下文

**水平扩展方式**：直接增加实例，无需共享存储。

### 4.2 模型文件缓存

Compute 使用 sentence-transformers 时，模型文件（~80MB）会缓存在本地磁盘：

```
~/.cache/torch/sentence_transformers/
└── all-MiniLM-L6-v2/
    └── 模型文件
```

**Docker 部署时**：
- 方案 A：将模型文件打包进镜像（镜像 +80MB，启动即可用）
- 方案 B：启动时从 HuggingFace 下载（首次启动 +2-3s）
- 方案 C：挂载 Host 缓存目录为 volume（推荐）

```yaml
# docker-compose.yml
services:
  compute:
    volumes:
      - ./hf_cache:/root/.cache/huggingface
```

---

## 五、Aggregator Service → MongoDB

### 5.1 为什么选 MongoDB？

Aggregator 的数据特点：
- 外部用户/问题：半结构化文档（字段可能变化）
- 运营配置：灵活 Schema（热门问题随时调整）
- 未来可能需要全文搜索（问题标题搜索）

**MongoDB 适合的原因**：
- 文档型，Schema 灵活（外部平台字段可能变化）
- 原生 JSON，和前端数据结构一致
- 中文全文搜索（MongoDB Atlas Search 或自建 Elasticsearch）
- 比 PostgreSQL 更适合非关系型、多变的数据

### 5.2 为什么不用 Elasticsearch？

| 方案 | 适用场景 |
|------|----------|
| **MongoDB** | 文档存储 + 简单搜索，当前规模足够 |
| **Elasticsearch** | 复杂全文搜索、聚合分析、大规模日志 |

当前 Aggregator 的数据量很小（40 domain × 3 用户 = 120 条，3 问题 × 3 问题 = 9 条），MongoDB 完全够用。

**未来升级路径**：
- 数据量 < 1万条：MongoDB 自带 text index
- 需要复杂语义搜索：Elasticsearch + 同步 pipeline

### 5.3 MongoDB Collection 设计

```javascript
// external_users
{
  _id: ObjectId,
  platform: "zhihu",
  name: "张小龙的产品观",
  avatar: "🔥",
  title: "连续创业者，前腾讯产品总监",
  followers: "23.5万",
  url: "https://www.zhihu.com/people/...",
  domain: "startup",
  is_active: true,
  created_at: ISODate
}

// external_questions
{
  _id: ObjectId,
  platform: "zhihu",
  title: "大厂程序员该不该辞职创业？",
  url: "https://www.zhihu.com/question/...",
  views: "12.4万",
  keywords: ["大厂", "创业"],
  preset_name: "大厂创业",
  is_active: true
}

// presets
{
  _id: ObjectId,
  type: "hot_question",
  icon_type: "briefcase",
  label: "职业",
  text: "大厂5年了，该辞职去做AI创业吗？",
  color: "#60a5fa",
  order: 1
}
```

---

## 六、关键决策：是否每个服务独立数据库？

### 6.1 微服务数据库原则

**理想状态**：每个微服务拥有自己的数据库实例，通过 API 访问其他服务的数据。

**当前现实**：黑客松 Demo，数据量极小（每个 Space 最多 6 agents、15 edges）。

### 6.2 推荐方案：逻辑隔离，物理共享

```
┌─────────────────────────────────────────────┐
│           单个 PostgreSQL 实例               │
│  (未来拆分时，通过逻辑复制或备份还原即可分离)  │
├─────────────────────────────────────────────┤
│  Schema: core_service                        │
│    ├── spaces, agents, edges, debates        │
│    ├── trajectories, trajectory_events       │
│    └── agent_embeddings (pgvector)           │
├─────────────────────────────────────────────┤
│  Schema: generator_service                   │
│    └── 空（Generator 使用 Redis，不存 PG）   │
├─────────────────────────────────────────────┤
│  Schema: aggregator_service                  │
│    ├── external_users                        │
│    ├── external_questions                    │
│    └── presets                               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Redis 实例（Generator 专用）                │
│    ├── debate:{edge_hash}                    │
│    └── agents:{query_hash}                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  MongoDB 实例（Aggregator 专用）             │
│    ├── external_users                        │
│    ├── external_questions                    │
│    └── presets                               │
└─────────────────────────────────────────────┘
```

**理由**：
- 使用 PostgreSQL Schema 做逻辑隔离，代码层面互不访问
- 未来拆分简单：导出 schema → 创建新实例 → 改连接字符串
- 当前运维复杂度最低（只需维护 3 个数据库组件）

### 6.3 未来拆分路径

当某个服务的数据量或访问压力达到瓶颈时：

```
Phase 1（当前）: 1 PG + 1 Redis + 1 MongoDB
       │
       ▼  Core Service 数据量激增
Phase 2: Core 拆出独立 PG
       │
       ▼  Trajectory 时间序列数据激增
Phase 3: Trajectory 迁移到 TimescaleDB
       │
       ▼  语义搜索需求增强
Phase 4: Embedding 迁移到专用向量库（Milvus/Pinecone）
```

---

## 七、Docker Compose 部署方案

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ── 数据库 ──
  postgres:
    image: ankane/pgvector:v0.5.1
    environment:
      POSTGRES_USER: cognitive
      POSTGRES_PASSWORD: cognitive_pass
      POSTGRES_DB: cognitive_space
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  mongo:
    image: mongo:6
    environment:
      MONGO_INITDB_ROOT_USERNAME: cognitive
      MONGO_INITDB_ROOT_PASSWORD: cognitive_pass
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  # ── 后端服务 ──
  core:
    build: ./services/core
    environment:
      DATABASE_URL: postgresql://cognitive:cognitive_pass@postgres:5432/cognitive_space
      DATABASE_SCHEMA: core_service
    depends_on:
      - postgres

  generator:
    build: ./services/generator
    environment:
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - redis

  compute:
    build: ./services/compute
    volumes:
      - hf_cache:/root/.cache/huggingface

  aggregator:
    build: ./services/aggregator
    environment:
      MONGO_URL: mongodb://cognitive:cognitive_pass@mongo:27017/cognitive_space?authSource=admin
    depends_on:
      - mongo

  gateway:
    build: ./services/gateway
    ports:
      - "8000:8000"
    depends_on:
      - core
      - generator
      - compute
      - aggregator

  # ── 前端 ──
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"

volumes:
  pg_data:
  redis_data:
  mongo_data:
  hf_cache:
```

---

## 八、迁移优先级

| 优先级 | 服务 | 数据库 | 工作量 | 影响 |
|--------|------|--------|--------|------|
| **P0** | Core | PostgreSQL + pgvector | 2-3 天 | 数据不再丢失，核心功能可用 |
| **P1** | Aggregator | MongoDB | 0.5 天 | 外部数据持久化，运营可配置 |
| **P2** | Generator | Redis | 0.5 天 | 缓存 LLM 结果，降低成本 |
| **P3** | Trajectory | TimescaleDB | 1 天 | 大数据量时性能提升（可延后） |
| **P4** | Embedding | 专用向量库 | 3-5 天 | 大规模语义搜索（可延后） |

---

## 九、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| pgvector 性能不足 | 当前数据量极小（<1000 向量），性能不是问题。未来可迁移到专用向量库 |
| MongoDB 增加运维成本 | 当前数据量极小，可用嵌入式 MongoDB（LiteDB）或直接用 PostgreSQL JSONB 替代 |
| Redis 数据丢失 | 缓存数据可重新生成（LLM 调用），非关键业务数据 |
| 多数据库连接复杂 | 使用环境变量配置连接字符串，各服务独立管理自己的连接池 |
| Schema 变更频繁 | 使用 Alembic（PostgreSQL）和 MongoDB 的灵活 Schema，减少迁移成本 |

---

*文档版本：v1.0*  
*对应架构版本：微服务 v0.2.0*
