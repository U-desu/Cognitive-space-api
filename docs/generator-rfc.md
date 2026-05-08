# RFC: Generator Service — 多智能体认知生成引擎

> **Status**: `Implemented`  
> **Version**: 0.2.0  
> **Last Updated**: 2026-05-08  
> **Owner**: Cognitive Space Team

---

## 1. 摘要（Overview）

Generator Service 是 Cognitive Space 系统的**认知生成核心**，负责将用户的决策问题转化为结构化的多智能体认知空间。它提供三大能力：

| 能力 | 说明 |
|------|------|
| **Agent 生成** | 根据用户问题自动生成 3-5 个具有不同立场、领域和人格的专家角色 |
| **辩论生成** | 驱动多智能体进行结构化辩论，输出逐轮发言与裁判总结 |
| **文本向量化** | 为认知空间中的概念提供 Embedding 支持 |

Generator 采用 **FastAPI + LangChain + OpenAI SDK** 构建，支持真实 LLM 调用与 Mock 模式无缝切换。

---

## 2. 背景与动机（Background & Motivation）

Cognitive Space 的核心假设是：**复杂决策需要多视角碰撞**。Generator Service 的设计目标是：

1. **自动化角色构建** — 用户只需输入问题，系统自动生成对立/互补的专家角色
2. **结构化辩论** — 不是自由对话，而是有轮次、有立场的结构化交锋
3. **可解释的认知输出** — 不仅给结论，还要暴露共识与分歧（Synthesis）
4. **流式体验** — 辩论过程对用户可见，而非黑盒等待

---

## 3. 架构总览（Architecture）

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Generator Service (Port 8002)                   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  /agents     │  │  /debates    │  │  /embeddings             │ │
│  │  .generate   │  │  .generate   │  │  .generate               │ │
│  │  (同步)       │  │  .generate-  │  │  (同步)                   │ │
│  │              │  │   stream     │  │                          │ │
│  │              │  │  (SSE 流式)   │  │                          │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘ │
│         │                 │                       │               │
│         └─────────────────┼───────────────────────┘               │
│                           ▼                                       │
│         ┌─────────────────────────────────────┐                   │
│         │         LLM Abstraction Layer        │                   │
│         │  ┌─────────────┐  ┌─────────────┐   │                   │
│         │  │ llm_chain   │  │ llm_client  │   │                   │
│         │  │ (LangChain  │  │ (OpenAI SDK │   │                   │
│         │  │  Pydantic)  │  │  + Mock)    │   │                   │
│         │  └─────────────┘  └─────────────┘   │                   │
│         └─────────────────────────────────────┘                   │
│                           │                                       │
│         ┌─────────────────┼─────────────────┐                     │
│         ▼                 ▼                 ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐           │
│  │ DebateState │  │ DebateAgent │  │ ModeratorAgent  │           │
│  │ (状态机)     │  │ (单角色 LLM)│  │ (结构化裁判)     │           │
│  └─────────────┘  └─────────────┘  └─────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP / SSE
                              │
                    ┌─────────┴─────────┐
                    │     Gateway       │
                    │   (Port 8000)     │
                    └───────────────────┘
```

---

## 4. 技术栈（Tech Stack）

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| Web 框架 | FastAPI | 0.111+ | 异步 API，自动 OpenAPI 文档 |
| LLM 编排 | LangChain | 0.2+ | Prompt 模板、链式调用、Pydantic Parser |
| LLM SDK | OpenAI Python SDK | 1.35+ | 支持 OpenAI / DeepSeek / Kimi 等兼容端点 |
| 数据校验 | Pydantic | 2.7+ | 全链路模型约束与接口契约 |
| 服务运行 | Uvicorn | 0.30+ | ASGI 服务器 |
| 配置管理 | python-dotenv | — | `.env` 环境变量加载 |
| 数据库 | SQLAlchemy | 2.0+ | 共享 ORM（实际写入由 Core Service 负责） |
| 向量计算 | OpenAI Embedding API | — | 支持真实 API 与 Mock hash 向量 |

---

## 5. 核心模块详解（Core Modules）

### 5.1 Router 层 — API 端点

#### `POST /generator/agents/generate` — 专家角色生成
- **输入**: `query` (用户问题) + 可选 `user_context`
- **输出**: `AgentListOutput` — 3-5 个专家角色，含 `name`, `persona`, `stance`, `domain`, `summary`
- **实现**: 单条 `build_structured_chain(AgentListOutput)` 调用
- **位置**: `routers/agents.py`

#### `POST /generator/debates/generate` — 同步辩论生成（Legacy）
- **输入**: `space_id`, `edge_id`, `agent_a`, `agent_b`, `edge`, `debate_request`
- **输出**: 完整 `Debate` 对象（transcript + synthesis）
- **实现**: 单条 LLM Chain 直接生成完整辩论
- **适用场景**: 快速兼容、无需流式体验的后台任务
- **位置**: `routers/debates.py`

#### `POST /generator/debates/generate-stream` — SSE 流式辩论生成 ⭐
- **输入**: 同上
- **输出**: `text/event-stream`
- **Event 类型**:
  - `event: turn` — 单轮发言（`round`, `agent`, `type`, `content`, `evidence`）
  - `event: synthesis` — 裁判总结（`core_conflict`, `resolution_suggestion`, ...）
  - `event: done` — 结束事件，含完整 debate payload
- **实现**: `DebateState` 驱动，`DebateAgent` 逐轮独立调用，`ModeratorAgent` 最终总结
- **适用场景**: 前端实时展示辩论过程
- **位置**: `routers/debates.py`

#### `POST /generator/embeddings/generate` — 文本向量化
- **输入**: `text`
- **输出**: 1536 维浮点向量
- **实现**: OpenAI `text-embedding-3-small` 或 Mock hash-based 向量
- **位置**: `routers/embeddings.py`

### 5.2 Agent 层 — 多智能体引擎

#### `DebateState` — 状态机
- **职责**: 维护辩论上下文，为每个 Agent 构建个性化 Prompt
- **核心状态**:
  - `turns: list[Turn]` — 已产生的发言记录
  - `current_round: int` — 当前轮次
  - `agent_a`, `agent_b`, `edge`, `focus_axes` — 辩论元信息
- **核心方法**:
  - `next_speaker()` — 根据已发言数量决定下一位发言者
  - `build_prompt_for(agent)` — 为特定 Agent 组装上下文 Prompt（含历史、对方身份、分歧轴）
  - `build_moderator_prompt()` — 为裁判组装总结 Prompt
- **位置**: `agents/debate_state.py`

#### `DebateAgent` — 单角色辩论智能体
- **设计**: 每个 Agent 拥有**独立的 `ChatOpenAI` 实例和 Chain**
- **Prompt 注入**: System Prompt 动态填充 `{name}`, `{persona}`, `{stance}`, `{summary}`
- **输出**: `Turn`（`agent`, `type`, `content`, `evidence`）
- **后处理**: 自动去除 `"AI创业者："`、`"我说："` 等常见前缀
- **位置**: `agents/debate_agent.py`

#### `ModeratorAgent` — 结构化裁判
- **设计**: 使用 `PydanticOutputParser` 强制输出结构化 JSON
- **Prompt 注入**: 完整辩论历史 + 分歧轴
- **输出**: `SynthesisOutput`
  - `core_conflict: str` — 核心冲突点
  - `resolution_suggestion: str` — 给用户的建议
  - `agreement_points: list[str]` — 双方共识
  - `divergence_points: list[str]` — 双方分歧
- **位置**: `agents/moderator_agent.py`

### 5.3 LLM 层 — 调用抽象

#### `llm_chain.py` — LangChain 结构化链
```python
def build_structured_chain(
    output_model: Type[BaseModel],
    system_prompt: str,
    temperature: float = 0.7
):
    """封装 Prompt → LLM → Pydantic Parser 的标准模式"""
```
- 所有结构化输出均通过此函数构建
- 内置 Output Models: `AgentOutput`, `AgentListOutput`, `TurnOutput`, `RoundOutput`, `SynthesisOutput`, `DebateOutput`

#### `llm_client.py` — 原始客户端 + Mock
```python
def chat_completion(messages, json_mode=False, temperature=0.7) -> str
def get_embedding(text: str) -> list[float]
```
- `MOCK_LLM=true` 时启用 Mock 模式
- Mock 通过关键词匹配返回预设数据（`mock_data.py`）
- Embedding Mock 使用 MD5 hash 生成确定性归一化向量

---

## 6. 配置项（Configuration）

### 环境变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `LLM_PROVIDER` | string | `openai` | 提供商: `openai` / `deepseek` / `kimi` |
| `OPENAI_API_KEY` | string | `""` | OpenAI API Key |
| `OPENAI_BASE_URL` | string | `https://api.openai.com/v1` | OpenAI 兼容端点 |
| `DEEPSEEK_API_KEY` | string | `""` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | string | `https://api.deepseek.com/v1` | DeepSeek 端点 |
| `MODEL_NAME` | string | `gpt-4o-mini` | 生成模型名称 |
| `EMBED_MODEL` | string | `text-embedding-3-small` | Embedding 模型名称 |
| `MOCK_LLM` | bool | `false` | `true` 时完全使用 Mock 数据，不调用外部 LLM |
| `GENERATOR_PORT` | int | `8002` | 服务监听端口 |
| `USE_REDIS` | bool | `false` | 预留：是否启用 Redis 缓存 |

### 当前生产配置示例（`.env`）
```bash
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
MOCK_LLM=false
```

---

## 7. 数据流与时序（Data Flow & Sequence）

### 7.1 Agent 生成流程

```
User Query
    │
    ▼
┌─────────────────┐
│ Gateway         │
│ (POST /spaces)  │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│ Generator /agents/generate   │
│                              │
│  build_structured_chain()    │
│  ├── System Prompt (角色池)   │
│  └── Human Prompt (query)    │
│       │                      │
│       ▼                      │
│  ChatOpenAI.invoke()         │
│       │                      │
│       ▼                      │
│  PydanticOutputParser        │
│  └── AgentListOutput         │
└────────┬─────────────────────┘
         │
         ▼
   Agent[] → Gateway → Core Service (持久化)
```

### 7.2 SSE 流式辩论流程

```
Frontend
   │ POST /spaces/{id}/debates/stream
   │ (body: edge_id, rounds)
   ▼
Gateway ──stream──► Generator /debates/generate-stream
   ▲                      │
   │                      ▼
   │              DebateState.init()
   │                      │
   │              for round in 1..n:
   │                  │
   │                  ├─► DebateAgent(A).invoke(state)
   │                  │   state.add_turn()
   │                  ◄─── yield event: turn
   │                  │
   │                  ├─► DebateAgent(B).invoke(state)
   │                  │   state.add_turn()
   │                  ◄─── yield event: turn
   │
   │              ModeratorAgent.invoke(state)
   │                  ◄─── yield event: synthesis
   │
   │                  ◄─── yield event: done
   │
   │ SSE (text/event-stream)
   ▼
Frontend 实时渲染
```

---

## 8. 扩展机制（Extensibility）

### 8.1 新增 LLM 提供商

在 `services/shared/config.py` 中增加 Provider 分支：

```python
# config.py
class Config:
    @property
    def API_KEY(self) -> str:
        if self.LLM_PROVIDER == "new_provider":
            return os.getenv("NEW_PROVIDER_API_KEY", "")
        ...

    @property
    def API_BASE_URL(self) -> str:
        if self.LLM_PROVIDER == "new_provider":
            return os.getenv("NEW_PROVIDER_BASE_URL", "")
        ...
```

### 8.2 新增专家角色（Persona）

在 `mock_data.py` 的 `ROLE_POOL` 中追加角色字典：

```python
ROLE_POOL = [
    # 现有角色...
    {
        "name": "新角色名",
        "persona": "角色人格描述...",
        "domain": "领域",
        "summary": "核心观点",
        "base_auth": 0.5,      # 权威度 0~1
        "base_nov": 0.5,       # 新颖度 0~1
        "stance_bias": "pro",  # 立场倾向
    },
]
```

> 非 Mock 模式下，角色由 LLM 根据问题动态生成，`ROLE_POOL` 仅用于 Mock 兜底。

### 8.3 新增辩论参与类型（Agent 类）

以新增 `JudgeAgent` 为例：

1. **新建文件**: `agents/judge_agent.py`
2. **仿照 `DebateAgent` 实现**:
   ```python
   class JudgeAgent:
       def __init__(self, temperature: float = 0.5):
           self.llm = ChatOpenAI(...)
           self.chain = self.prompt | self.llm | StrOutputParser()

       def invoke(self, state: DebateState) -> Turn:
           context = state.build_judge_prompt()
           ...
   ```
3. **导出**: 在 `agents/__init__.py` 中导出
4. **接入流式流程**: 在 `routers/debates.py` 的 `event_stream()` 中按需插入调用

### 8.4 自定义 Prompt 模板（未来）

当前 Prompt 为硬编码字符串常量。未来可提取为外部 YAML/JSON 配置，支持热加载：

```yaml
# prompts/debate_agent.yaml
system: |
  你是一位 {domain} 领域的专家，名叫 {name}。
  你的立场是 {stance}，人格特征：{persona}。
  ...
```

---

## 9. Mock 模式（Offline Development）

当 `MOCK_LLM=true` 或没有配置 API Key 时，Generator 进入 Mock 模式：

| 功能 | Mock 行为 |
|------|----------|
| Agent 生成 | 根据 `query` 关键词匹配 `QUESTION_AGENT_PRESETS` 返回预设角色 |
| 辩论生成 | 返回 `QUESTION_DEBATE_PRESETS` 中匹配的预设辩论 |
| Embedding | MD5(text) → 归一化 1536 维向量 |

**Mock 数据覆盖**:
- 40 个角色池（`ROLE_POOL`）
- 3 套问题预设（创业 vs 打工、买房 vs 租房、考研 vs 工作）

Mock 模式让开发者在无 API Key、无网络的情况下也能完整跑通前后端流程。

---

## 10. 部署与运行

### 独立启动
```bash
cd services/generator
python3 -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

### 通过项目脚本启动（推荐）
```bash
cd /project-root
bash scripts/start-services.sh
# Generator 将在 8002 端口启动
```

### 健康检查
```bash
curl http://localhost:8002/health
# {"status":"ok","service":"generator"}
```

---

## 11. 已知限制与未来规划（Roadmap）

### 当前限制
1. **Token 级流式不可行**: 结构化输出（Pydantic Parser）要求完整文本，因此 LLM 必须 `streaming=False`，后端只能做到轮次级 SSE
2. **Prompt 硬编码**: 所有 System Prompt 写在源码中，修改需重新部署
3. **无持久化**: Generator 本身不存储数据，所有状态由调用方（Gateway / Core）管理
4. **单轮对话**: Agent 之间无真正的记忆机制，仅通过 `DebateState.turns` 传递历史

### 未来规划
| 优先级 | 方向 | 说明 |
|--------|------|------|
| P1 | Prompt 外部化 | 支持 YAML/JSON 配置热加载 |
| P1 | Agent 记忆 | 引入短期记忆（Summary）与长期记忆（Vector Store） |
| P2 | Token 级流式 | 探索 `stream=True` + 增量 JSON Parser（如 `partial-json-parser`）|
| P2 | 更多 Agent 类型 | JudgeAgent、ObserverAgent、CrossExaminerAgent |
| P3 | 多模型混合 | 不同 Agent 使用不同模型（如轻量模型做快速响应，重模型做深度分析）|
| P3 | 评估与反馈 | 引入 LLM-as-a-Judge 评估辩论质量，闭环优化 Prompt |

---

## 附录 A：核心数据模型

```python
class Agent(BaseModel):
    agent_id: str
    name: str
    persona: str
    position: Position          # {authority: float, novelty: float}
    stance: Literal["pro", "con", "neutral"]
    confidence: float
    domain: str
    summary: str

class Turn(BaseModel):
    agent: str
    type: Literal["argument", "rebuttal"]
    content: str
    evidence: list[str]

class Synthesis(BaseModel):
    core_conflict: str
    resolution_suggestion: str
    agreement_points: list[str]
    divergence_points: list[str]

class Debate(BaseModel):
    debate_id: str
    edge_id: str
    participants: list[str]
    transcript: list[Round]
    synthesis: Synthesis
```

---

## 附录 B：接口契约（OpenAPI）

服务启动后访问：
- Swagger UI: `http://localhost:8002/docs`
- ReDoc: `http://localhost:8002/redoc`
- OpenAPI JSON: `http://localhost:8002/openapi.json`
