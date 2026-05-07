# 数据库迁移方案 — 决策罗盘

> 本文档将当前内存中的 Mock 数据迁移到 PostgreSQL 的完整设计方案，包括表结构、迁移步骤、前后端代码改动。

---

## 一、当前 Mock 数据关联全景图

```
用户输入 query
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  LandingPage.tsx                                            │
│  HOT_QUESTIONS[3] ──► 用户选择/输入问题                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /spaces                                               │
│  llm_client._match_preset(query)                            │
│  ──► 匹配到 3 个问题之一                                    │
│                                                             │
│  _QUESTION_AGENT_PRESETS[问题] ──► 固定 6 人角色组合        │
│  _generate_mock_agents()                                    │
│  ──► 从 _ROLE_POOL[40] 查找角色模板 ──► 生成 agents[]      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /spaces/{id}/edges                                    │
│  edge_service.compute_edges()                               │
│  ──► llm_client._mock_embedding(name+summary+persona)     │
│  ──► cosine_distance ──► conflict_score                   │
│  ⚠️ 问题：embedding 是 MD5 伪装的，冲突分数无语义          │
│  ⚠️ 无法精确控制哪对是 fundamental（推荐辩论）              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /spaces/{id}/debates                                  │
│  debate_service.run_debate(edge, agents, request)           │
│  ──► _build_prompt() 构造 prompt，含 [AGENTS:id1,id2]     │
│  ──► llm_client._mock_chat_completion()                     │
│      ──► 匹配问题 ──► 返回 _DEBATE_PRESETS[问题]            │
│      ──► 解析 [AGENTS:id1,id2] 标记                        │
│      ──► 替换 agent_001/agent_002 为实际 source/target      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AgentPanel.tsx                                             │
│  ──► ProfileContent：agent 基本信息                        │
│  ──► DebateContent：辩论 transcript + synthesis            │
│  ──► ClusterContent：                                       │
│      _matchQueryPreset(query) ──► 匹配问题                 │
│      PRESET_ZHIHU_QUESTIONS[问题] ──► 参考问题（3条）      │
│      MOCK_ZHIHU_USERS[domain] ──► 知乎用户（按 domain）    │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、已修复的 Bug

| Bug | 描述 | 修复方式 |
|-----|------|----------|
| 辩论参与者与实际对话不匹配 | `_DEBATE_PRESETS` 硬编码 `agent_001`/`agent_002`，但用户点击的 edge 可能是任意两个 agent | `debate_service.py` prompt 中加入 `[AGENTS:id1,id2]` 标记；`_mock_chat_completion` 解析后替换 transcript 中的 agent ID |

---

## 三、剩余的不一致问题（数据库迁移时一并解决）

| # | 问题 | 影响 | 数据库解决方案 |
|---|------|------|---------------|
| 1 | `compute_edges` 的冲突分数由 MD5 hash 决定，无法精确控制哪对是 fundamental | 用户可能看到不相关的 agent 对有"推荐辩论"按钮 | `edges` 表增加 `is_preset_recommended` 字段，Mock 模式下按 `query_presets` 配置覆盖冲突类型 |
| 2 | `_DEBATE_PRESETS` 只有一套辩论内容/问题，适用于任意 agent 对，但立场可能不匹配 | 两个中立派 agent 在激烈辩论 | `debate_templates` 使用 `__SOURCE__` / `__TARGET__` 占位符，内容更通用化；或增加多对组合的辩论模板 |
| 3 | `MOCK_ZHIHU_USERS` 只有 10 个 domain，30 个 domain fallback 到 startup | 大量角色聚类显示错误的领域用户 | `external_users` 表补全所有 40 个 domain 的知乎用户 |
| 4 | `store.py` 纯内存存储，重启后数据丢失 | 无法持久化 | 所有数据写入 PostgreSQL |

---

## 四、技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 数据库 | PostgreSQL 15+ | JSONB 支持灵活 schema，pgvector 扩展支持向量检索 |
| ORM | SQLAlchemy 2.0 + Alembic | FastAPI 生态原生支持，迁移管理成熟 |
| 向量索引 | pgvector | 1536 维 embedding，支持 cosine similarity 查询 |

---

## 五、表结构设计

### 5.1 角色模板库（原 `_ROLE_POOL`）

```sql
CREATE TABLE agent_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    persona TEXT NOT NULL,
    domain VARCHAR(50) NOT NULL,
    summary TEXT NOT NULL,
    base_authority FLOAT NOT NULL CHECK (base_authority BETWEEN 0 AND 1),
    base_novelty FLOAT NOT NULL CHECK (base_novelty BETWEEN 0 AND 1),
    default_stance VARCHAR(20) NOT NULL CHECK (default_stance IN ('pro', 'con', 'neutral')),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 问题预设配置（原 `_QUESTION_AGENT_PRESETS`）

```sql
CREATE TABLE query_presets (
    id SERIAL PRIMARY KEY,
    query_pattern VARCHAR(500) NOT NULL UNIQUE,
    keywords TEXT[] NOT NULL,              -- 用于模糊匹配的关键词
    preset_name VARCHAR(100) NOT NULL,     -- 人类可读名称
    agent_composition JSONB NOT NULL,      -- [{"template_id": 1, "stance_override": "pro"}, ...]
    debate_template_id INTEGER,            -- 关联 debate_templates
    external_question_ids INTEGER[],       -- 关联 external_questions
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.3 辩论模板（原 `_DEBATE_PRESETS`）

```sql
CREATE TABLE debate_templates (
    id SERIAL PRIMARY KEY,
    query_preset_id INTEGER REFERENCES query_presets(id) ON DELETE SET NULL,
    transcript JSONB NOT NULL,             -- 使用 __SOURCE__ / __TARGET__ 占位符
    synthesis JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.4 认知空间

```sql
CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    user_context JSONB,
    dimensions JSONB,
    metadata JSONB,
    preset_id INTEGER REFERENCES query_presets(id),  -- 匹配到的问题预设
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.5 角色实例（每个空间中的实际角色）

```sql
CREATE TABLE agents (
    id VARCHAR(50) PRIMARY KEY,            -- agent_001 格式
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES agent_templates(id),
    name VARCHAR(100) NOT NULL,
    persona TEXT,
    domain VARCHAR(50),
    summary TEXT,
    stance VARCHAR(20) CHECK (stance IN ('pro', 'con', 'neutral')),
    confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
    authority FLOAT CHECK (authority BETWEEN 0 AND 1),
    novelty FLOAT CHECK (novelty BETWEEN 0 AND 1),
    embedding VECTOR(1536),                -- pgvector，用于冲突计算
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(space_id, id)
);

CREATE INDEX idx_agents_space_stance ON agents(space_id, stance);
CREATE INDEX idx_agents_space_domain ON agents(space_id, domain);
```

### 5.6 冲突边

```sql
CREATE TABLE edges (
    id VARCHAR(50) PRIMARY KEY,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    source_agent_id VARCHAR(50) NOT NULL REFERENCES agents(id),
    target_agent_id VARCHAR(50) NOT NULL REFERENCES agents(id),
    conflict_score FLOAT NOT NULL CHECK (conflict_score BETWEEN 0 AND 1),
    conflict_type VARCHAR(20) CHECK (conflict_type IN ('fundamental', 'partial', 'minor')),
    shared_ground TEXT[],
    divergence_axes JSONB,
    debate_recommended BOOLEAN DEFAULT FALSE,
    is_preset_recommended BOOLEAN DEFAULT FALSE,  -- Mock 模式下覆盖用
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(space_id, source_agent_id, target_agent_id)
);

CREATE INDEX idx_edges_space ON edges(space_id);
CREATE INDEX idx_edges_recommended ON edges(space_id, debate_recommended) WHERE debate_recommended = TRUE;
```

### 5.7 辩论

```sql
CREATE TABLE debates (
    id VARCHAR(50) PRIMARY KEY,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    edge_id VARCHAR(50) NOT NULL REFERENCES edges(id),
    participants VARCHAR(50)[] NOT NULL,
    transcript JSONB NOT NULL,
    synthesis JSONB NOT NULL,
    visualization JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.8 轨迹

```sql
CREATE TABLE trajectories (
    id VARCHAR(50) PRIMARY KEY,
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    cognitive_metrics JSONB NOT NULL DEFAULT '{
        "coverage_area": 0.18,
        "depth_score": 0.12,
        "breadth_score": 0.25,
        "conflict_engagement": 0.10
    }',
    journey_stage VARCHAR(50) DEFAULT 'exploration',
    suggested_next JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trajectory_events (
    id SERIAL PRIMARY KEY,
    trajectory_id VARCHAR(50) NOT NULL REFERENCES trajectories(id) ON DELETE CASCADE,
    node VARCHAR(50) NOT NULL,             -- agent_id 或特殊标记
    action VARCHAR(50) NOT NULL,           -- view_agent, debate, focus_switch
    dwell_time INTEGER,                    -- 毫秒
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trajectory_events_traj ON trajectory_events(trajectory_id);
CREATE INDEX idx_trajectory_events_time ON trajectory_events(created_at);
```

### 5.9 外部平台用户（原 `MOCK_ZHIHU_USERS`）

```sql
CREATE TABLE external_users (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL DEFAULT 'zhihu',
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(20),                    -- emoji
    title TEXT,
    followers VARCHAR(20),
    url TEXT,
    domain VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_external_users_domain ON external_users(domain);
```

### 5.10 外部平台问题（原 `MOCK_ZHIHU_QUESTIONS`）

```sql
CREATE TABLE external_questions (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL DEFAULT 'zhihu',
    title TEXT NOT NULL,
    url TEXT,
    views VARCHAR(20),
    keywords TEXT[],                       -- 用于匹配 query
    preset_id INTEGER REFERENCES query_presets(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 六、关键设计决策

### 6.1 角色模板 vs 角色实例

- `agent_templates` 存储 40 人角色池（可扩展）
- `agents` 存储每个 space 的实际角色（引用模板 + 覆盖 stance/position）
- 同一个模板可以在不同问题中有不同立场

### 6.2 辩论模板的占位符设计

```json
{
  "transcript": [
    {
      "round": 1,
      "turns": [
        {"agent": "__SOURCE__", "type": "argument", "content": "..."},
        {"agent": "__TARGET__", "type": "rebuttal", "content": "..."}
      ]
    }
  ]
}
```

运行时替换 `__SOURCE__` → `edge.source`，`__TARGET__` → `edge.target`。

### 6.3 预设配置的灵活性

- `query_presets` 的 `agent_composition` 用 JSONB 存储，方便调整角色组合
- `keywords` 数组用于模糊匹配，未来可扩展更多 demo 问题

### 6.4 Embedding 存储

- 使用 `pgvector` 的 `VECTOR(1536)` 类型
- 冲突计算可直接在 SQL 中执行：`SELECT 1 - (a.embedding <=> b.embedding) AS conflict_score`
- 比 Python 循环计算快 10-100 倍

---

## 七、Mock/真实模式的数据流对比

```
┌────────────────────────────────────────────────────────────────┐
│                         Mock 模式                              │
├────────────────────────────────────────────────────────────────┤
│  1. 用户输入 query                                             │
│  2. _match_preset(query) ──► 匹配 query_presets 记录         │
│  3. 读取 query_presets.agent_composition                       │
│  4. 从 agent_templates 查找模板 ──► 创建 agents 记录           │
│  5. 从 debate_templates 读取辩论内容（__SOURCE__占位符）       │
│  6. 创建 edges 记录（冲突分数可硬编码或基于 template embedding）│
│  7. 创建 debates 记录（替换占位符）                            │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                        真实 LLM 模式                           │
├────────────────────────────────────────────────────────────────┤
│  1. 用户输入 query                                             │
│  2. 调用 OpenAI API 生成 agents ──► 创建 agents 记录           │
│  3. 调用 OpenAI Embedding API ──► 计算 agents.embedding        │
│  4. SQL 计算所有 agent 对的 cosine_distance ──► 创建 edges     │
│  5. 调用 OpenAI API 生成辩论内容 ──► 创建 debates 记录         │
│  6. 实时计算 trajectory metrics                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 八、Alembic 迁移脚本（种子数据）

```python
# migrations/001_initial.py
from alembic import op
import sqlalchemy as sa
import json

def upgrade():
    # 1. 创建 pgvector 扩展
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    
    # 2. 创建所有表（见上方 SQL）
    # ...
    
    # 3. 导入角色模板数据（原 _ROLE_POOL）
    op.bulk_insert('agent_templates', [
        {"name": "AI创业者", "persona": "连续创业者，窗口期敏感", "domain": "startup",
         "summary": "窗口期有限，AI基础设施已成熟", "base_authority": 0.75, "base_novelty": 0.92, "default_stance": "pro"},
        {"name": "大厂高管", "persona": "资深技术总监，稳健派", "domain": "enterprise",
         "summary": "体系内积累比盲目创业更稳妥", "base_authority": 0.88, "base_novelty": 0.35, "default_stance": "con"},
        # ... 共 40 条
    ])
    
    # 4. 导入问题预设（原 _QUESTION_AGENT_PRESETS）
    op.bulk_insert('query_presets', [
        {
            "query_pattern": "大厂5年了，该辞职去做AI创业吗？",
            "keywords": ["大厂", "辞职", "创业", "AI创业"],
            "preset_name": "大厂创业",
            "agent_composition": json.dumps([
                {"template_name": "AI创业者", "stance_override": "pro"},
                {"template_name": "大厂高管", "stance_override": "con"},
                {"template_name": "早期投资人", "stance_override": "neutral"},
                {"template_name": "风险分析师", "stance_override": "con"},
                {"template_name": "独立开发者", "stance_override": "pro"},
                {"template_name": "财务顾问", "stance_override": "con"},
            ]),
        },
        {
            "query_pattern": "AI发展这么快，程序员会被取代吗？",
            "keywords": ["程序", "取代", "失业", "替代"],
            "preset_name": "程序员取代",
            "agent_composition": json.dumps([
                {"template_name": "技术布道者", "stance_override": "pro"},
                {"template_name": "大学教授", "stance_override": "con"},
                {"template_name": "全栈工程师", "stance_override": "pro"},
                {"template_name": "心理学家", "stance_override": "neutral"},
                {"template_name": "哲学家", "stance_override": "neutral"},
                {"template_name": "科技记者", "stance_override": "neutral"},
            ]),
        },
        {
            "query_pattern": "30岁该继续深耕技术还是转管理？",
            "keywords": ["管理", "转管理", "深耕技术", "技术还是管理"],
            "preset_name": "技术管理",
            "agent_composition": json.dumps([
                {"template_name": "大厂高管", "stance_override": "con"},
                {"template_name": "全栈工程师", "stance_override": "pro"},
                {"template_name": "HR总监", "stance_override": "neutral"},
                {"template_name": "咨询顾问", "stance_override": "neutral"},
                {"template_name": "产品经理", "stance_override": "neutral"},
                {"template_name": "技术作家", "stance_override": "pro"},
            ]),
        },
    ])
    
    # 5. 导入辩论模板（原 _DEBATE_PRESETS，使用 __SOURCE__ / __TARGET__ 占位符）
    op.bulk_insert('debate_templates', [
        {
            "query_preset_id": 1,
            "transcript": json.dumps({
                "transcript": [
                    {"round": 1, "turns": [
                        {"agent": "__SOURCE__", "type": "argument", "content": "大厂5年积累的技术洞察、行业人脉和资金储备，正是AI创业最稀缺的启动资本。当前AI应用层窗口期约18个月，错过这波将失去先发优势。", "evidence": ["2024年AI应用层融资同比增长300%", "头部AI创业公司创始人平均大厂背景5.2年"]},
                        {"agent": "__TARGET__", "type": "rebuttal", "content": "但数据显示首次创业失败率高达92%，大厂光环在创业战场并不值钱。稳定的年薪、股票和五险一金，是35岁前最该珍惜的杠杆。", "evidence": ["《中国创业者生存报告》：首次创业失败率92.3%", "大厂P8以上年薪中位数80万+"]},
                    ]},
                    {"round": 2, "turns": [
                        {"agent": "__SOURCE__", "type": "argument", "content": "所以我们不应该all in，而是先用副业验证PMF——下班后跑通MVP、验证付费意愿，降低试错成本。", "evidence": ["YC校友调研：副业验证后创业成功率提升至35%"]},
                        {"agent": "__TARGET__", "type": "rebuttal", "content": "副业和全职创业是完全两种心态。下班后做side project是兴趣驱动，全职创业是生存驱动——用户付费意愿、团队招募速度、抗压能力，在副业模式下根本无法真实验证。", "evidence": ["副业项目的用户留存率平均仅为全职项目的1/5"]},
                    ]},
                ]
            }),
            "synthesis": json.dumps({
                "core_conflict": "风险判断的时间尺度不同：创业者看18个月窗口期，稳健派看35岁前的职业安全边际",
                "resolution_suggestion": "建议用3-6个月副业深度验证PMF，若月活>1000且付费转化>5%，再考虑全职；否则继续深耕大厂并积累行业资源",
                "agreement_points": ["AI是长期趋势不可逆", "需要准备而非冲动", "大厂经验是宝贵资产"],
                "divergence_points": ["最佳入场时机（现在 vs 3年后）", "可接受的风险水平（all in vs 副业验证）", "成功概率评估（8% vs 35%）"]
            }),
        },
        # ... 问题2、问题3 的辩论模板同理
    ])
    
    # 6. 导入外部用户（原 MOCK_ZHIHU_USERS，需补全 40 个 domain）
    op.bulk_insert('external_users', [
        {"name": "张小龙的产品观", "avatar": "🔥", "domain": "startup",
         "title": "连续创业者，前腾讯产品总监", "followers": "23.5万", "url": "https://www.zhihu.com/people/zhangxiaolong"},
        {"name": "李想", "avatar": "🚀", "domain": "startup",
         "title": "理想汽车创始人", "followers": "18.2万", "url": "https://www.zhihu.com/people/lixiang"},
        # ... 每个 domain 3 人，共 120 条（40 domain × 3）
    ])
    
    # 7. 导入外部问题（原 MOCK_ZHIHU_QUESTIONS，3 个问题 × 3 条）
    op.bulk_insert('external_questions', [
        {"title": "大厂程序员该不该辞职创业？", "keywords": ["大厂", "创业"], "preset_id": 1, "views": "12.4万", "url": "https://www.zhihu.com/question/mock001"},
        {"title": "AI创业窗口期还有多久？", "keywords": ["AI", "创业"], "preset_id": 1, "views": "8.7万", "url": "https://www.zhihu.com/question/mock002"},
        {"title": "副业验证PMF再全职创业靠谱吗？", "keywords": ["副业", "创业"], "preset_id": 1, "views": "5.2万", "url": "https://www.zhihu.com/question/mock003"},
        # ... 问题2、问题3 的参考问题
    ])

def downgrade():
    op.execute("DROP TABLE IF EXISTS trajectory_events CASCADE")
    op.execute("DROP TABLE IF EXISTS trajectories CASCADE")
    op.execute("DROP TABLE IF EXISTS debates CASCADE")
    op.execute("DROP TABLE IF EXISTS edges CASCADE")
    op.execute("DROP TABLE IF EXISTS agents CASCADE")
    op.execute("DROP TABLE IF EXISTS spaces CASCADE")
    op.execute("DROP TABLE IF EXISTS external_questions CASCADE")
    op.execute("DROP TABLE IF EXISTS external_users CASCADE")
    op.execute("DROP TABLE IF EXISTS debate_templates CASCADE")
    op.execute("DROP TABLE IF EXISTS query_presets CASCADE")
    op.execute("DROP TABLE IF EXISTS agent_templates CASCADE")
```

---

## 九、后端代码改动清单

| 文件 | 改动内容 |
|------|----------|
| `app/db.py` | 新增：SQLAlchemy engine + SessionLocal + Base |
| `app/config.py` | 新增：`DATABASE_URL` 配置项 |
| `app/models/db_models.py` | 新增：所有表的 SQLAlchemy ORM 模型 |
| `app/store.py` | 重构：从内存 dict 改为数据库 CRUD |
| `app/services/llm_client.py` | 重构：Mock 模式从数据库读取模板和预设 |
| `app/services/edge_service.py` | 优化：使用 SQL `embedding <=>` 计算冲突分数 |
| `app/services/debate_service.py` | 不变：prompt 中已含 `[AGENTS:id1,id2]` 标记 |
| `app/routers/` | 新增：`GET /external-users?domain=` 和 `GET /external-questions?query=` |

### 9.1 store.py 重构示例

```python
from sqlalchemy.orm import Session
from app.models.db_models import SpaceModel, AgentModel, EdgeModel, DebateModel

class Store:
    def __init__(self, db: Session):
        self.db = db
    
    def get_space(self, space_id: str) -> Optional[Space]:
        row = self.db.query(SpaceModel).filter(SpaceModel.id == space_id).first()
        return self._to_pydantic(row) if row else None
    
    def create_space(self, space: Space) -> Space:
        db_space = SpaceModel(
            id=space.space_id,
            query=space.query,
            dimensions=space.dimensions,
            metadata=space.metadata,
        )
        self.db.add(db_space)
        self.db.commit()
        return space
    
    def save_agents(self, space_id: str, agents: list[Agent]) -> None:
        for a in agents:
            self.db.add(AgentModel(
                id=a.agent_id,
                space_id=space_id,
                name=a.name,
                stance=a.stance,
                # ...
            ))
        self.db.commit()
```

---

## 十、前端代码改动清单

| 文件 | 改动内容 |
|------|----------|
| `frontend/src/api.ts` | 新增：`getExternalUsers(domain)`、`getExternalQuestions(query)` |
| `frontend/src/components/AgentPanel.tsx` | 移除：`MOCK_ZHIHU_USERS`、`MOCK_ZHIHU_QUESTIONS`、`PRESET_ZHIHU_QUESTIONS`。改为从 API 获取 |
| `frontend/src/components/AgentPanel.tsx` | 移除：`handleDebate` catch 块中的硬编码 fallback debate（后端已持久化） |

### 10.1 AgentPanel.tsx 数据获取示例

```typescript
// 移除所有 MOCK_ZHIHU_* 常量

function ClusterContent({ agentDomain, agentStance, spaceQuery, onBack }: {
  agentDomain?: string
  agentStance: string
  spaceQuery: string
  onBack: () => void
}) {
  const [users, setUsers] = useState<ExternalUser[]>([])
  const [questions, setQuestions] = useState<ExternalQuestion[]>([])
  
  useEffect(() => {
    if (!agentDomain) return
    api.getExternalUsers(agentDomain).then(setUsers)
  }, [agentDomain])
  
  useEffect(() => {
    if (!spaceQuery) return
    api.getExternalQuestions(spaceQuery).then(setQuestions)
  }, [spaceQuery])
  
  // ... 渲染逻辑不变，数据源从 state 读取
}
```

---

## 十一、迁移步骤 Checklist

| 步骤 | 任务 | 文件/位置 |
|------|------|-----------|
| 1 | 添加 PostgreSQL + pgvector 到 docker-compose | `docker-compose.yml` |
| 2 | 添加数据库连接配置 | `app/config.py` |
| 3 | 创建 SQLAlchemy 模型 | `app/models/db_models.py` |
| 4 | 初始化 Alembic | `alembic init migrations` |
| 5 | 编写初始迁移 + 种子数据 | `migrations/versions/001_initial.py` |
| 6 | 重构 `store.py` 为数据库操作 | `app/store.py` |
| 7 | 重构 `llm_client.py` mock 逻辑 | `app/services/llm_client.py` |
| 8 | 重构 `edge_service.py` 使用 SQL 计算冲突 | `app/services/edge_service.py` |
| 9 | 新增外部用户/问题 API | `app/routers/external.py` |
| 10 | 前端移除硬编码 mock，调用新 API | `frontend/src/components/AgentPanel.tsx` |
| 11 | 运行全量测试 | `tests/test_api.py` |
| 12 | 更新 README 部署说明 | `README.md` |

---

## 十二、ER 图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ agent_templates │     │  query_presets  │     │ debate_templates│
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────┤ id (PK)         │────►│ id (PK)         │
│ name            │     │ query_pattern   │     │ query_preset_id │
│ persona         │     │ keywords[]      │     │ transcript      │
│ domain          │     │ agent_composition│    │ synthesis       │
│ summary         │     │ debate_template_id│   └─────────────────┘
│ base_authority  │     └─────────────────┘
│ base_novelty    │              │
│ default_stance  │              │
└─────────────────┘              │
         ▲                       │
         │                       │
         │              ┌────────▼────────┐
         │              │     spaces      │
         │              ├─────────────────┤
         │              │ id (PK)         │
         │              │ query           │
         │              │ preset_id (FK)  │
         │              └─────────────────┘
         │                       │
         │                       │
         │              ┌────────▼────────┐     ┌─────────────────┐
         └──────────────┤     agents      │     │     edges       │
                        ├─────────────────┤     ├─────────────────┤
                        │ id (PK)         │◄────┤ source_agent_id │
                        │ space_id (FK)   │     │ target_agent_id │
                        │ template_id (FK)│     │ space_id (FK)   │
                        │ name            │     │ conflict_score  │
                        │ stance          │     │ conflict_type   │
                        │ embedding       │     │ debate_recommended
                        └─────────────────┘     └─────────────────┘
                                                       │
                                                       │
                                              ┌────────▼────────┐
                                              │    debates      │
                                              ├─────────────────┤
                                              │ id (PK)         │
                                              │ edge_id (FK)    │
                                              │ participants[]  │
                                              │ transcript      │
                                              │ synthesis       │
                                              └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│ external_users  │     │external_questions│
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ name            │     │ title           │
│ domain          │     │ keywords[]      │
│ followers       │     │ preset_id (FK)  │
│ url             │     │ views           │
└─────────────────┘     └─────────────────┘
```

---

*文档版本：v1.0*  
*对应代码提交：待迁移完成后更新*
