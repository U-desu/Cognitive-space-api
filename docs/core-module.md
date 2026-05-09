# Core Service 架构设计文档

> 本文档描述 Core Service（业务数据服务）的架构、模块划分、数据模型和关键设计决策。
>
> 对应架构版本：微服务 v0.2.0  
> 文档版本：v1.0

---

## 服务定位

Core Service 是 Cognitive Space 的**业务数据持久化层**，负责所有结构化业务数据的存储和检索：

| 实体 | 说明 | 关系 |
|------|------|------|
| **Space** | 认知空间容器 | 1 个 Space → N 个 Agent |
| **Agent** | 专家角色节点 | N 个 Agent → C(N,2) 条 Edge |
| **Edge** | 冲突边 | 1 条 Edge → 0~1 个 Debate |
| **Debate** | 辩论记录 | 绑定到 Edge |
| **Trajectory** | 认知轨迹 | 1 个 Space → 1 个 Trajectory |
| **TrajectoryEvent** | 轨迹事件 | 1 个 Trajectory → N 个 Event |

**设计原则**：
- **纯存储，无业务逻辑**：不调用 LLM，不做计算，只做 CRUD
- **双后端透明切换**：`USE_DB=false`（内存）/ `true`（PostgreSQL），代码零改动
- **Schema 隔离**：所有表在 PostgreSQL `core` schema 下，与其他服务物理隔离
- **级联删除**：删除 Space 自动级联删除其 Agents、Edges、Debates、Trajectories

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Core Service (port 8001)                  │
│                                                              │
│  ┌─────────────┐   ┌─────────────────────────────────────┐  │
│  │  Routers    │   │           Store Layer                │  │
│  │             │◄──│                                      │  │
│  │ /spaces     │   │  store.py ──Dispatcher──┬──────────┐ │  │
│  │ /edges      │   │                         │          │ │  │
│  │ /debates    │   │    ┌────────────────┐   │   ┌────────┐│  │
│  │ /trajectories│  │    │ memory_store.py│   │   │db_store.py│
│  │ /export     │   │    │ (dict-backed)  │   │   │(SQLAlchemy)│
│  └─────────────┘   │    └────────────────┘   │   └────────┘│
│                    └─────────────────────────┴─────────────┘
│                                    │
│                    ┌───────────────┴───────────────┐
│                    │        ORM Models              │
│                    │  SpaceDB / AgentDB / EdgeDB    │
│                    │  DebateDB / TrajectoryDB ...   │
│                    └───────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

## 模块详解

### 1. Store Dispatcher (`store.py`)

**职责**：根据 `USE_DB` 环境变量，在运行时选择内存或 PostgreSQL 后端。

```python
from services.shared.db_config import USE_DB

if USE_DB:
    from services.core.db_store import (
        save_space, get_space, list_spaces, delete_space,
        add_agents_to_space,
        save_edges, get_edges, get_edge, update_edge,
        save_debate, get_debate, get_debates_by_edge,
        get_or_create_trajectory, save_trajectory,
    )
else:
    from services.core.memory_store import (
        save_space, get_space, list_spaces, delete_space,
        ...  # 完全相同的函数签名
    )
```

**设计意义**：
- 所有 Router 统一 `from services.core import store`，无需关心底层实现
- 新增存储后端时，只需实现相同接口的模块，修改 `store.py` 即可
- 测试环境可用内存模式，生产环境切 PostgreSQL，代码零改动

---

### 2. PostgreSQL Store (`db_store.py`)

**职责**：SQLAlchemy ORM 实现，完整的事务管理、回滚、Session 生命周期。

**Session 管理模式**：
```python
session_gen = get_db_session()   # 生成器，yield Session
session = next(session_gen)      # 获取 Session

try:
    # CRUD 操作
    session.commit()
except Exception:
    session.rollback()
    raise
finally:
    try:
        next(session_gen, None)  # 关闭 Session
    except StopIteration:
        pass
```

**为什么用生成器管理 Session？**
- 避免 Session 泄漏（每个请求独立 Session）
- 与 `get_db_session()` 的生成器实现一致
- `finally` 块确保 Session 始终关闭，即使异常退出

**CRUD 函数清单**：

| 函数 | 说明 | 事务行为 |
|------|------|----------|
| `save_space(space)` | UPSERT Space + 批量 UPSERT Agents | 单事务 |
| `get_space(space_id)` | 读取 Space + 关联 Agents | 只读 |
| `list_spaces()` | 读取所有 Space + 各自 Agents | 只读 |
| `delete_space(space_id)` | 删除 Space（DB 级联删除关联数据） | 单事务 |
| `add_agents_to_space(space_id, agents)` | 追加 Agents（去重） | 单事务 |
| `save_edges(space_id, edges)` | UPSERT Edges | 单事务 |
| `get_edges(space_id)` | 读取 Space 下所有 Edges | 只读 |
| `get_edge(space_id, edge_id)` | 读取单条 Edge | 只读 |
| `save_debate(debate)` | UPSERT Debate | 单事务 |
| `get_debate(debate_id)` | 读取单条 Debate | 只读 |
| `get_debates_by_edge(edge_id)` | 按 Edge 查询 Debates | 只读 |
| `get_or_create_trajectory(space_id)` | 读取或初始化 Trajectory | 单事务 |
| `save_trajectory(trajectory)` | UPSERT Trajectory | 单事务 |

**Pydantic ↔ SQLAlchemy 转换**：

每个实体都有一对 `_to_db` / `_from_db` 转换函数：

```python
def _space_to_db(space: Space) -> SpaceDB:
    # Pydantic Dimension 对象 → dict → JSONB
    dims = {k: v.model_dump() if hasattr(v, "model_dump") else v
            for k, v in (space.dimensions or {}).items()}
    return SpaceDB(space_id=..., query=..., dimensions=dims, ...)

def _space_from_db(row: SpaceDB) -> Space:
    # JSONB → dict → Pydantic Dimension 对象
    dims = {k: Dimension(**v) if isinstance(v, dict) else v
            for k, v in (row.dimensions or {}).items()}
    return Space(space_id=..., query=..., dimensions=dims, ...)
```

**设计要点**：
- `save_space` 同时处理 Space 和 Agents 的 UPSERT（避免多次往返）
- `get_space` 自动加载关联 Agents（手动 `query(AgentDB).filter_by(space_id=...)`）
- 所有 JSONB 字段在写入前调用 `.model_dump()`，读取后重建 Pydantic 对象

---

### 3. Memory Store (`memory_store.py`)

**职责**：纯字典存储，零依赖，零配置。

```python
_spaces: Dict[str, Space] = {}      # space_id → Space
_edges: Dict[str, list[Edge]] = {}  # space_id → [Edge, ...]
_debates: Dict[str, Debate] = {}    # debate_id → Debate
_trajectories: Dict[str, Trajectory] = {}  # space_id → Trajectory
```

**与 DB Store 的差异**：
- 删除 Space 时，需**手动清理**关联的 edges、debates、trajectories（无 DB 级联）
- `get_or_create_trajectory` 初始化默认认知指标值
- 无事务概念，操作原子性由 Python GIL 保证（单进程场景）

---

### 4. ORM Models (`models_db.py`)

**Schema**: `core`

#### 模型概览

```
spaces (1) ──────► agents (N)
   │                  │
   │                  │
   ▼                  ▼
edges (N) ◄────── agents (FK: source_agent_id, target_agent_id)
   │
   ▼
debates (0~1)
   │
   ▼
trajectories (1) ──► trajectory_events (N)
```

#### SpaceDB

```python
class SpaceDB(Base):
    space_id = Column(String(20), primary_key=True)
    query = Column(Text, nullable=False)
    dimensions = Column(JSONB, nullable=False, default=dict)
    metadata_ = Column("metadata", JSONB, nullable=False, default=dict)
    user_id = Column(String(30), nullable=True)  # 无 ORM FK，DB 层维护
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

#### AgentDB

```python
class AgentDB(Base):
    agent_id = Column(String(50), primary_key=True)
    space_id = Column(String(20), ForeignKey("core.spaces.space_id", ondelete="CASCADE"), primary_key=True)
    name = Column(String(100), nullable=False)
    persona = Column(Text)
    domain = Column(String(50))
    summary = Column(Text)
    stance = Column(String(20))
    confidence = Column(Float)
    authority = Column(Float)
    novelty = Column(Float)
    embedding = Column(PG_ARRAY(Float))
    parent_id = Column(String(20), nullable=True)  # 自引用 FK（DB 层维护）
```

**复合主键**：`(space_id, agent_id)`
- 同一 agent_id 可在不同 space 中复用（虽然业务上不会）
- space_id 为 clustered index，Space 下 Agent 查询高效

#### EdgeDB

```python
class EdgeDB(Base):
    edge_id = Column(String(50), primary_key=True)
    space_id = Column(String(20), ForeignKey("core.spaces.space_id", ondelete="CASCADE"), primary_key=True)
    source_agent_id = Column(String(50), nullable=False)
    target_agent_id = Column(String(50), nullable=False)
    conflict_score = Column(Float, nullable=False)
    conflict_type = Column(String(20))
    shared_ground = Column(PG_ARRAY(Text))
    divergence_axes = Column(JSONB)
    debate_recommended = Column(Boolean, default=False)
```

**复合外键约束**（DB 层）：
```sql
FOREIGN KEY (space_id, source_agent_id)
    REFERENCES core.agents(space_id, agent_id)
    ON DELETE CASCADE

FOREIGN KEY (space_id, target_agent_id)
    REFERENCES core.agents(space_id, agent_id)
    ON DELETE CASCADE
```

#### DebateDB

```python
class DebateDB(Base):
    debate_id = Column(String(20), primary_key=True)
    space_id = Column(String(20), ForeignKey("core.spaces.space_id", ondelete="CASCADE"), nullable=False)
    edge_id = Column(String(50), nullable=False)
    participants = Column(PG_ARRAY(Text), nullable=False)
    transcript = Column(JSONB, nullable=False)
    synthesis = Column(JSONB, nullable=False)
```

**复合外键约束**（DB 层）：
```sql
FOREIGN KEY (space_id, edge_id)
    REFERENCES core.edges(space_id, edge_id)
    ON DELETE CASCADE
```

#### TrajectoryDB

```python
class TrajectoryDB(Base):
    trajectory_id = Column(String(20), primary_key=True)
    space_id = Column(String(20), ForeignKey("core.spaces.space_id", ondelete="CASCADE"), nullable=False, unique=True)
    path = Column(JSONB, nullable=False, default=list)
    cognitive_metrics = Column(JSONB, nullable=False, default=dict)
    journey_stage = Column(String(50), default="exploration")
    suggested_next = Column(JSONB)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

#### TrajectoryEventDB

```python
class TrajectoryEventDB(Base):
    event_id = Column(Integer, primary_key=True, autoincrement=True)
    trajectory_id = Column(String(20), ForeignKey("core.trajectories.trajectory_id", ondelete="CASCADE"), nullable=False)
    node = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    dwell_time = Column(Integer, default=0)
```

---

### 5. Routers

#### Spaces Router (`routers/spaces.py`)

| 端点 | 方法 | 说明 | 调用方 |
|------|------|------|--------|
| `POST /spaces` | 禁用 | 直接创建 Space 被禁用（需 Gateway 编排） | - |
| `POST /spaces/ingest` | 可用 | 接收完整 Space 对象并存储 | Gateway |
| `GET /spaces/{space_id}` | 可用 | 读取 Space + Agents | Gateway / 前端 |
| `GET /spaces` | 可用 | 列出所有 Space | Gateway |
| `GET /spaces/my/{user_id}` | 可用 | 按用户查询 Space（配合 auth store） | Gateway |
| `POST /spaces/{space_id}/agents` | 可用 | 追加 Agent（去重） | Gateway（expand 后） |
| `DELETE /spaces/{space_id}` | 可用 | 删除 Space（级联删除） | Gateway / 测试 |

#### Edges Router (`routers/edges.py`)

| 端点 | 方法 | 说明 | 调用方 |
|------|------|------|--------|
| `POST /spaces/{space_id}/edges` | 可用 | 批量存储 Edges | Gateway（Compute 计算后） |
| `GET /spaces/{space_id}/edges` | 可用 | 读取 Space 下所有 Edges | Gateway |
| `GET /spaces/{space_id}/edges/{edge_id}` | 可用 | 读取单条 Edge | Gateway |

#### Debates Router (`routers/debates.py`)

| 端点 | 方法 | 说明 | 调用方 |
|------|------|------|--------|
| `POST /debates/ingest` | 可用 | 存储 Debate | Gateway（Generator 生成后） |
| `GET /debates/{debate_id}` | 可用 | 读取 Debate | Gateway |
| `GET /debates/by-edge/{edge_id}` | 可用 | 按 Edge 查询 Debates | Gateway |

#### Trajectories Router (`routers/trajectories.py`)

| 端点 | 方法 | 说明 | 调用方 |
|------|------|------|--------|
| `POST /trajectories/actions` | 可用 | 记录用户行为 | Gateway（用户交互后） |
| `GET /trajectories/{space_id}` | 可用 | 读取/初始化 Trajectory | Gateway |

#### Export Router (`routers/export.py`)

| 端点 | 方法 | 说明 | 调用方 |
|------|------|------|--------|
| `POST /spaces/{space_id}/export` | 可用 | 导出 Space（JSON / Shareable Card） | Gateway / 前端 |

**导出格式**：
- `json`：返回 Space + Edges + 可选 Trajectory
- `shareable_card`：返回分享卡片（标题、摘要、统计数据）

---

## 关键设计决策

### 1. 为什么禁用 `POST /spaces` 直接创建？

Core Service 的 `POST /spaces` 返回 400：
```python
@router.post("")
def create_space(request: CreateSpaceRequest):
    raise HTTPException(status_code=400, detail="Use gateway /spaces endpoint")
```

**原因**：
- Space 创建需要 Generator 先生成 Agents，这是 Gateway 的编排职责
- Core 只负责**存储已构造好的完整 Space**，不参与生成逻辑
- 防止绕过 Gateway 直接调用导致数据不完整

### 2. 为什么用复合主键？

`agents` 和 `edges` 使用复合主键 `(space_id, id)`：

**优点**：
- Space 下查询天然高效（clustered index 前缀匹配）
- 不同 Space 可使用相同的业务 ID（如 `agent_001`）
- 与 PostgreSQL 分区表兼容（未来可按 space_id 分区）

**代价**：
- 外键约束也必须复合（`space_id + agent_id`）
- 查询单条记录时需同时提供 space_id 和 id

### 3. ORM 与 DB 外键解耦

Core Service 的 ORM 模型**不定义跨 schema 的 ForeignKey**：

| 字段 | ORM 层 | DB 层 |
|------|--------|-------|
| `spaces.user_id` | 纯 `String(30)` 列 | `FK → auth.users`（fix_schema.py 维护） |
| `agents.parent_id` | 纯 `String(20)` 列 | `FK → core.agents`（fix_schema.py 维护） |

**原因**：
- `auth` schema 属于 Gateway Service，Core 不应在 ORM 中硬引用
- 避免服务启动时的 `NoReferencedTableError`（跨服务表不可见）
- DB 层面的 FK 约束仍通过 `scripts/fix_schema.py` 维护，保证数据一致性

### 4. 级联删除策略

```
DELETE spaces
  └── CASCADE → agents
        └── CASCADE → edges
              └── CASCADE → debates
  └── CASCADE → trajectories
        └── CASCADE → trajectory_events
```

**实现方式**：
- DB 层：`ON DELETE CASCADE` 外键约束
- ORM 层：`session.delete(space_row)` + `session.commit()`
- 内存层：手动清理关联字典

---

## 与 Gateway 的交互契约

Core Service 不直接面向前端，所有请求由 Gateway 编排：

### Space 创建流程
```
Gateway:
  1. 调用 Generator 生成 Agents
  2. 构造 Space 对象（含 Agents）
  3. POST /spaces/ingest → Core

Core:
  1. store.save_space(space)  # UPSERT Space + Agents
  2. 返回 Space

Gateway:
  3. 若用户已登录，调用 auth store 关联 space 到 user
  4. 返回 Space 给前端
```

### Edge 计算流程
```
Gateway:
  1. GET /spaces/{space_id} → Core（获取 Space + Agents）
  2. POST /compute/edges/compute → Compute（计算 Edges）
  3. POST /spaces/{space_id}/edges → Core（存储 Edges）

Core:
  1. store.save_edges(space_id, edges)  # UPSERT
  2. 返回 {"saved": N}
```

### Debate 生成流程
```
Gateway:
  1. GET /spaces/{space_id} → Core（获取 Space）
  2. GET /spaces/{space_id}/edges/{edge_id} → Core（获取 Edge）
  3. POST /generator/debates/generate → Generator（生成 Debate）
  4. POST /debates/ingest → Core（存储 Debate）
  5. POST /trajectories/actions → Core（记录 trajectory）
  6. POST /compute/metrics/compute → Compute（计算 Metrics）
  7. POST /trajectories/actions → Core（更新 Trajectory）
```

---

## 配置说明

Core Service 从 `services/shared/db_config.py` 读取配置：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `USE_DB` | `false` | `true`=PostgreSQL, `false`=内存模式 |
| `DATABASE_URL` | `postgresql://localhost:5432/cognitive_space` | PostgreSQL 连接地址 |
| `DB_SCHEMA_CORE` | `core` | Core schema 名称 |

---

## 性能与扩展

| 指标 | 当前配置 | 说明 |
|------|----------|------|
| 连接池 | `pool_size=3`, `max_overflow=0` | 单机演示配置 |
| 驱动 | `psycopg` (psycopg3) | 官方同步驱动 |
| 索引 | 主键 + 外键 | 当前数据量小，无需额外索引 |
| 级联删除 | DB 级 | `ON DELETE CASCADE` 自动处理 |

**水平扩展**：
- Core Service 是**有状态服务**（数据存储），不可直接多实例
- 扩展方式：
  1. **垂直扩展**：提升 PostgreSQL 实例配置
  2. **读写分离**：主库写 + 只读副本读（需改 session 路由）
  3. **分库分表**：按 `space_id` 哈希分片（未来需求）

---

## 相关文档

- [`docs/database.md`](database.md) — 数据库设计文档（Schema/表结构/约束）
- [`docs/generator.md`](generator.md) — Generator Service 架构（Agent/Debate 生成）
- [`docs/api-design.md`](api-design.md) — API 完整设计（Gateway 层接口）
