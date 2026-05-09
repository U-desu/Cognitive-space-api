# Generator Service 架构设计文档

> 本文档描述 Generator Service（LLM 生成服务）的架构、模块划分、数据流和关键设计决策。
>
> 对应架构版本：微服务 v0.2.0  
> 文档版本：v1.0

---

## 服务定位

Generator Service 是 Cognitive Space 的**内容生成引擎**，负责所有与 LLM 相关的 creative output：

| 能力 | 说明 | 调用方 |
|------|------|--------|
| **Agent 生成** | 从用户 query 生成 3-5 个不同视角的专家 Agent | Gateway (`POST /spaces`) |
| **Agent 展开** | 基于已有 Agent 生成关联子视角 | Gateway (`POST /agents/{id}/expand`) |
| **辩论生成（同步）** | 生成完整的结构化辩论（transcript + synthesis） | Gateway (`POST /debates`) |
| **辩论生成（流式）** | SSE 逐轮推送，每轮独立 LLM 生成 | Gateway (`POST /debates/stream`) |
| **文本 Embedding** | 为文本生成语义向量（OpenAI / Mock） | Gateway / Compute（已 deprecated） |

**设计原则**：
- **纯生成，无状态**：不保存业务数据，输出交给 Gateway 存入 Core
- **可插拔 LLM 提供商**：OpenAI、DeepSeek、Kimi 等任意 OpenAI-compatible API
- **Mock 兜底**：无 API key 时自动回退到高质量预设数据
- **结构化输出**：所有 LLM 调用通过 PydanticOutputParser 强制 JSON schema

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Generator Service (port 8002)             │
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐   │
│  │  Routers    │   │  LLM Chain  │   │  Multi-Agent    │   │
│  │             │◄──│  Layer      │◄──│  Debate System  │   │
│  │ /agents     │   │             │   │                 │   │
│  │ /debates    │   │ Structured  │   │ DebateAgent x2  │   │
│  │ /embeddings │   │ Output      │   │ ModeratorAgent  │   │
│  └─────────────┘   │ Pydantic    │   │ DebateState     │   │
│                    └─────────────┘   └─────────────────┘   │
│                          │                                   │
│                    ┌─────┴─────┐                            │
│                    │ LLM Client│                            │
│                    │           │                            │
│                    │ OpenAI SDK│──► Real API (DeepSeek etc) │
│                    │ Mock Layer│──► Preset Data             │
│                    └───────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 模块详解

### 1. LLM Client (`llm_client.py`)

**职责**：底层 LLM 调用封装，处理 provider 配置、embedding 缓存。

**架构**：
```
chat_completion(messages, json_mode=False)
├── 已移除
│   ├── 辩论提示词 → DEBATE_PRESETS[query_match]
│   └── Agent 提示词 → QUESTION_AGENT_PRESETS[query_match]
│
└── OpenAI SDK
    ├── API_KEY 未配置 → RuntimeError
    ├── json_mode=true → response_format={"type": "json_object"}
    └── 异常时 → fallback_debate()（仅辩论场景）
```

**Mock 模式**：
- 通过关键词匹配（如"程序""取代"→程序员预设）选择对应的预设数据
- 辩论预设支持动态替换 agent_id（如将 `agent_001` 替换为实际参与者 ID）
- Embedding：OpenAI API（带缓存）

**Embedding 缓存**：
```python
_embedding_cache: dict[str, list[float]] = {}  # text_hash → vector
# Future: Redis cache with TTL
```

---

### 2. LLM Chain (`llm_chain.py`)

**职责**：LangChain 结构化输出层，统一 prompt 管理和 schema 约束。

**核心函数**：
```python
def build_structured_chain(
    output_model: Type[BaseModel],    # Pydantic 输出模型
    system_prompt: str,               # 系统提示词
    temperature: float = 0.7,
) -> RunnableSerializable:
    # prompt | llm | PydanticOutputParser
```

**结构化输出模型**：

| 模型 | 用途 | 字段 |
|------|------|------|
| `AgentOutput` | 单个 Agent | agent_id, name, persona, stance, confidence, domain, summary |
| `AgentListOutput` | Agent 列表 | agents: list[AgentOutput] |
| `TurnOutput` | 辩论回合 | agent, type, content, evidence |
| `RoundOutput` | 辩论轮次 | round, turns: list[TurnOutput] |
| `SynthesisOutput` | 辩论合成 | core_conflict, resolution_suggestion, agreement_points, divergence_points |
| `DebateOutput` | 完整辩论 | transcript, synthesis |

**为什么用 LangChain + PydanticOutputParser？**
1. **Schema 约束**：LLM 输出必须符合 Pydantic 模型，字段缺失/类型错误自动重试
2. **Prompt 自动注入**：`parser.get_format_instructions()` 自动生成 JSON schema 说明
3. **Provider 无关**：`ChatOpenAI` 支持任意 OpenAI-compatible API（DeepSeek、Kimi、Azure）

---

### 3. Agent 生成 Router (`routers/agents.py`)

**端点**：

#### `POST /generator/agents/generate`

**输入**：`GenerateAgentsRequest(query, user_context)`

**流程**：
```
用户 query + context
    │
    ▼
┌─────────────────┐
│  SYSTEM_PROMPT  │  ← 认知空间设计师角色
│  (llm_chain.py) │
└─────────────────┘
    │
    ▼
AgentListOutput (3-5 个 Agent)
    │
    ▼
映射为 Pydantic Agent 模型
    │
    ▼
GenerateAgentsResponse(agents=[], latency_ms=0)
```

**System Prompt 核心要求**：
- 生成 3-5 个 Agent，覆盖不同立场和视角
- authority/novelty 坐标映射（由前端根据返回内容分配具体坐标）
- 确保 Agent 之间存在真实观点差异

#### `POST /generator/agents/expand`

**输入**：`ExpandAgentRequest(parent_agent, query_hint, num_agents)`

**流程**：
```
父 Agent persona + stance + summary + query_hint
    │
    ▼
┌──────────────────┐
│ EXPAND_PROMPT    │  ← 基于已有视角展开延伸
│ (llm_chain.py)   │
└──────────────────┘
    │
    ▼
AgentListOutput (num_agents 个)
    │
    ▼
生成唯一 ID: {parent_id}_child_{uuid[:6]}
设置 parent_id = parent.agent_id
    │
    ▼
ExpandAgentResponse(parent_agent_id, new_agents)
```

**展开策略**：
- 新 Agent 必须是父 Agent 的延伸、深化或对立视角
- 立场可相同（细化子观点）或不同（反驳/修正）
- Agent ID 格式：`agent_001_child_a3f7b2`，确保唯一且可追溯父子关系

---

### 4. 辩论生成 Router (`routers/debates.py`)

提供两种生成模式：

#### 模式 A：同步生成 (`POST /generator/debates/generate`)

**适用场景**：普通 HTTP 请求，前端等待完整响应

**流程**：
```
agent_a + agent_b + edge + debate_request(rounds, focus_axes)
    │
    ▼
┌─────────────────┐
│ Debate SYSTEM   │  ← 结构化辩论主持人
│ _build_input()  │     注入双方 persona + edge 信息
└─────────────────┘
    │
    ▼
DebateOutput (transcript + synthesis)
    │
    ▼
Debate(debate_id, space_id, edge_id, participants, transcript, synthesis)
```

**特点**：
- 单轮 LLM 调用生成完整辩论
- 速度快（1 次 API 调用）
- 适合对延迟不敏感的场景

#### 模式 B：SSE 流式生成 (`POST /generator/debates/generate-stream`)

**适用场景**：前端实时展示辩论过程，每轮生成后立刻渲染

**流程**：
```
初始化：
  DebateState(agent_a, agent_b, edge, rounds)
  DebateAgent(profile=agent_a)
  DebateAgent(profile=agent_b)

For each round:
  ┌─ Agent A 发言 ─┐
  │  DebateAgent.invoke(state) ──► Turn ──► SSE: event=turn  │
  │  state.add_turn(turn)                                    │
  ├─ Agent B 回应 ─┤
  │  DebateAgent.invoke(state) ──► Turn ──► SSE: event=turn  │
  │  state.add_turn(turn)                                    │
  └────────────────┘

最后：
  ModeratorAgent.invoke(state) ──► Synthesis ──► SSE: event=synthesis
  完整 Debate payload ──► SSE: event=done
```

**SSE 事件格式**：
```
event: turn
data: {"round": 1, "agent": "agent_001", "type": "argument", "content": "...", "evidence": []}

event: synthesis
data: {"core_conflict": "...", "resolution_suggestion": "...", ...}

event: done
data: {"debate_id": "...", "transcript": [...], "synthesis": {...}}
```

**为什么用多 Agent 逐轮生成？**
1. **角色一致性**：每个 DebateAgent 有独立的 system prompt（注入 persona/stance），保持角色不漂移
2. **上下文感知**：每轮生成能看到前面的完整对话历史（通过 DebateState 传递）
3. **流式体验**：用户看到辩论"实时进行"，增强沉浸感
4. **可控性**：可随时中断、调整 temperature、添加 moderator 干预

---

### 5. 多 Agent 辩论系统 (`agents/`)

```
agents/
├── debate_agent.py      # 单个辩论参与者
├── debate_state.py      # 辩论上下文管理
└── moderator_agent.py   # 认知合成专家
```

#### DebateAgent (`debate_agent.py`)

每个辩论参与者是一个**独立的 LLM 实例**：

```python
class DebateAgent:
    def __init__(self, profile: Agent, temperature: float = 0.7):
        # 独立 ChatOpenAI 实例
        self.llm = ChatOpenAI(model=..., temperature=temperature)
        # 注入角色的 system prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_TEMPLATE),  # 注入 name/persona/stance/summary
            ("human", "{context}"),
        ])
        self.chain = self.prompt | self.llm | StrOutputParser()
```

**生成单轮发言**：
1. DebateState 构建当前上下文的 human prompt（包含历史记录、分歧轴、轮次信息）
2. Chain 调用，同时注入角色的 system prompt 变量
3. 输出清理（去除常见前缀如"我说："、角色名等）
4. 返回 `Turn(agent_id, type, content, evidence=[])`

#### DebateState (`debate_state.py`)

**职责**：管理辩论的完整上下文，为每个 Agent 构建 prompt。

**核心方法**：

| 方法 | 说明 |
|------|------|
| `add_turn(turn)` | 添加一轮发言，自动推进轮次计数 |
| `next_speaker()` | 根据发言数量奇偶性决定下一个发言者 |
| `next_turn_type()` | argument（偶数轮）/ rebuttal（奇数轮） |
| `build_prompt_for(agent)` | 构建完整的 human prompt（身份、分歧轴、历史、任务） |
| `build_moderator_prompt()` | 为合成阶段构建 moderator prompt |

**Prompt 结构示例**：
```
辩论主题：agent_001 与 agent_002 之间的认知冲突

你的身份：
- 姓名：AI创业者
- 人设：连续创业者，窗口期敏感
- 立场：pro
- 核心观点：窗口期有限，AI基础设施已成熟

对方身份：
- 姓名：大厂高管
- 人设：资深技术总监，稳健派
- 立场：con

双方的分歧轴：
  - 时机判断：现在入场 vs 3年后再看
  - 风险偏好：all in vs 稳健积累

当前轮次：第 1 轮 / 共 2 轮
你的任务：发表你的立论。请清晰阐述你的核心观点，并给出具体论据。

辩论历史：
（辩论刚刚开始，尚无历史记录）

请直接输出你的发言内容：
```

#### ModeratorAgent (`moderator_agent.py`)

**职责**：辩论结束后，基于完整历史生成结构化 synthesis。

**特点**：
- 使用 `PydanticOutputParser` 强制输出 `SynthesisOutput` 结构
- Temperature 较低（0.5），保证合成结果的稳定性
- 独立的 prompt 模板，角色为"认知合成专家"

---

### 6. Preset 数据层 (`preset_data.py`)

**设计目标**：无 API key 时提供高质量的确定性演示数据。

**数据结构**：

```python
ROLE_POOL = [          # 40 个预设角色
    {"name": "AI创业者", "persona": "...", "domain": "startup", ...},
    ...
]

QUESTION_AGENT_PRESETS = {  # 3 个问题的预设 Agent 组合
    "大厂5年了，该辞职去做AI创业吗？": [
        {"name": "AI创业者", "stance": "pro"},
        {"name": "大厂高管", "stance": "con"},
        ...
    ],
    ...
}

DEBATE_PRESETS = {      # 3 个问题的预设辩论稿
    "大厂5年了...": {
        "transcript": [...],
        "synthesis": {...}
    },
    ...
}

FALLBACK_DEBATES = {    # LLM 失败时的通用回退
    "default": {...}
}
```

**Mock 生成逻辑**：
1. 关键词匹配 query → 选择对应预设
2. 从 `ROLE_POOL` 中查找角色详情
3. 组装为 AgentListOutput / DebateOutput 结构
4. 辩论预设支持动态替换 agent_id

---

## API 接口清单

| 端点 | 方法 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| `/generator/agents/generate` | POST | `GenerateAgentsRequest` | `GenerateAgentsResponse` | 生成 Agent 列表 |
| `/generator/agents/expand` | POST | `ExpandAgentRequest` | `ExpandAgentResponse` | 基于父 Agent 展开 |
| `/generator/debates/generate` | POST | `GenerateDebateRequest` | `Debate` | 同步生成完整辩论 |
| `/generator/debates/generate-stream` | POST | `GenerateDebateRequest` | SSE Stream | 流式逐轮生成 |
| `/generator/debates/fallback` | POST | - | `Debate` | 回退辩论（LLM 失败时） |
| `/generator/embeddings/generate` | POST | `EmbeddingRequest` | `EmbeddingResponse` | 文本嵌入 |

---

## 与 Gateway 的交互契约

Generator Service 不直接面向前端，所有请求由 Gateway 编排：

### Agent 生成流程
```
Gateway: POST /generator/agents/generate
  Body: {query, user_context}

Generator:
  1. 构建 prompt（query + user_context）
  2. LangChain 调用 LLM
  3. 解析为 AgentListOutput
  4. 映射为 Pydantic Agent 列表
  5. 返回 GenerateAgentsResponse

Gateway:
  1. 接收 agents
  2. 构造 Space 对象
  3. POST /spaces/ingest 到 Core Service 存储
```

### Debate 生成流程（同步）
```
Gateway: POST /generator/debates/generate
  Body: {space_id, edge_id, agent_a, agent_b, edge, debate_request}

Generator:
  1. 构建辩论 prompt（双方 persona + edge 信息）
  2. LangChain 调用 LLM
  3. 解析为 DebateOutput
  4. 构造 Debate 对象（生成 debate_id）
  5. 返回 Debate

Gateway:
  1. 接收 Debate
  2. POST /debates/ingest 到 Core Service 存储
  3. 记录 trajectory action
  4. 调用 Compute 计算 metrics
```

### Debate 生成流程（流式）
```
Gateway: POST /generator/debates/generate-stream
  Body: 同同步模式
  Response: SSE Stream

Gateway 作为 SSE Proxy：
  1. 接收 Generator 的 SSE 事件
  2. 透传给前端（添加必要 headers）
  3. 前端实时渲染每轮发言
```

---

## 配置说明

Generator Service 从 `services/shared/config.py` 读取配置：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `LLM_PROVIDER` | `openai` | 提供商：`openai` / `deepseek` |
| `API_KEY` | - | 根据 provider 自动选择 `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY` |
| `API_BASE_URL` | - | 根据 provider 自动选择 |
| `MODEL_NAME` | `gpt-4o-mini` / `deepseek-chat` | 模型名称 |
| 已移除 | - | 运行时必须配置 LLM API key |
| `EMBED_MODEL` | `text-embedding-3-small` | Embedding 模型 |

---

## 性能与扩展

| 指标 | 当前 | 优化方向 |
|------|------|----------|
| Agent 生成延迟 | 3-10s（LLM API） | Redis 缓存（TTL: 1h） |
| 辩论生成延迟（同步） | 5-15s（LLM API） | Redis 缓存（TTL: 7d） |
| 辩论生成延迟（流式） | 首字 1-3s，每轮 1-3s | 无法缓存，依赖 LLM 实时生成 |
| Embedding | 50-200ms（OpenAI）/ 100-500ms（local） | 内存缓存（已实现）→ Redis |

**水平扩展**：
- Generator Service 无状态，可直接多实例部署
- 需要配合负载均衡（如 nginx / k8s ingress）

---

## 相关文档

- [`docs/compute-module.md`](compute-module.md) — Compute 服务模块说明（embedding、edge 计算、metrics）
- [`docs/api-design.md`](api-design.md) — API 完整设计（Gateway 层接口）
