# Cognitive Space API - Python 后端实现计划

## 项目概述

基于现有 API 设计文档，用 Python 实现一个可运行的 Cognitive Space 后端服务。核心功能：
- 接收用户查询，生成认知空间（多 Agent 视角）
- 计算 Agent 间的冲突边（pairwise diversity）
- 触发结构化辩论
- 追踪用户认知轨迹并计算认知扩展指数

## 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| Web 框架 | **FastAPI** | 自动 OpenAPI 文档、Pydantic 原生集成、异步支持 |
| 数据校验 | **Pydantic v2** | 强类型、JSON Schema 自动生成、与 FastAPI 无缝配合 |
| LLM 调用 | **OpenAI SDK** | 默认支持 OpenAI，通过环境变量可切换至兼容接口（如 Kimi、DeepSeek） |
| Embedding | **OpenAI text-embedding-3-small** | 语义距离计算，低成本 |
| 存储 | **内存（Python dict）** | 黑客松场景优先速度，空间/辩论数据量小 |
| 运行 | **Uvicorn** | ASGI 服务器，支持热重载 |

## 目录结构

```
cognitive-space-api/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口，注册路由
│   ├── config.py            # 环境变量与配置（LLM key、模型名）
│   ├── models/              # Pydantic 数据模型
│   │   ├── __init__.py
│   │   ├── agent.py
│   │   ├── edge.py
│   │   ├── space.py
│   │   ├── debate.py
│   │   └── trajectory.py
│   ├── services/            # 核心业务逻辑
│   │   ├── __init__.py
│   │   ├── llm_client.py    # LLM / Embedding 调用封装
│   │   ├── space_service.py # 空间创建、Agent 生成
│   │   ├── edge_service.py  # 冲突边计算
│   │   ├── debate_service.py# 辩论生成
│   │   └── trajectory_service.py # 轨迹追踪与指标计算
│   ├── routers/             # API 路由
│   │   ├── __init__.py
│   │   ├── spaces.py        # /spaces/* 端点
│   │   └── export.py        # /spaces/{id}/export 端点
│   └── store.py             # 内存存储（space_id -> Space 对象）
├── tests/                   # 单元测试
│   └── test_api.py
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md                # 更新为运行指南
```

## 实现步骤

### Phase 1: 基础骨架（30 min）
1. 创建 `requirements.txt`（fastapi, uvicorn, pydantic, openai, python-dotenv）
2. 创建 `config.py` 读取 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `MODEL_NAME` / `EMBED_MODEL`
3. 创建 `store.py`：内存 dict + 简单的 CRUD 辅助函数
4. 创建 `main.py`：FastAPI 实例 + 健康检查 `/health`

### Phase 2: 数据模型（20 min）
1. `models/agent.py`：`Agent`, `Position`, `Stance` enum
2. `models/space.py`：`CreateSpaceRequest`, `Space`, `Dimension`
3. `models/edge.py`：`Edge`, `DivergenceAxis`, `SpaceStats`
4. `models/debate.py`：`DebateRequest`, `Debate`, `Turn`, `Synthesis`
5. `models/trajectory.py`：`TrajectoryPoint`, `Trajectory`, `CognitiveMetrics`

### Phase 3: 核心服务（60 min）
1. `services/llm_client.py`：
   - `chat_completion(messages, json_mode=False)` → 返回结构化内容
   - `get_embedding(text)` → 返回向量
2. `services/space_service.py`：
   - `create_space(query, user_context)`：调用 LLM 生成 3-5 个 Agent（含坐标）
   - `get_space(space_id)`
3. `services/edge_service.py`：
   - `compute_edges(space)`：遍历 Agent pairs，embedding 计算 cosine distance，生成 Edge 列表 + SpaceStats
4. `services/debate_service.py`：
   - `run_debate(edge, format, rounds, focus_axes)`：构造 system/user prompt，生成结构化辩论记录
5. `services/trajectory_service.py`：
   - `record_action(space_id, node, action, dwell_time)`：追加轨迹点
   - `compute_metrics(trajectory, space)`：coverage_area（凸包面积）、depth_score、breadth_score

### Phase 4: API 路由（40 min）
1. `routers/spaces.py` 实现 5 个端点：
   - `POST /spaces`
   - `POST /spaces/{space_id}/perspectives`
   - `POST /spaces/{space_id}/edges`
   - `POST /spaces/{space_id}/debates`
   - `GET /spaces/{space_id}/trajectory`
2. `routers/export.py`：
   - `POST /spaces/{space_id}/export`（shareable_card / markdown / json）

### Phase 5: 测试与验证（30 min）
1. `tests/test_api.py`：用 `TestClient` 编写端到端测试
   - 创建空间 → 计算边 → 触发辩论 → 获取轨迹
2. 本地运行 `uvicorn app.main:app --reload`，用 curl / Swagger UI 验证

## 关键设计决策

1. **内存存储**：黑客松场景下数据量极小（一个空间通常 <10 Agent），内存存储足够且零配置。后续可无缝替换为 Redis / SQLite。
2. **LLM 生成 Agent 坐标**：Authority / Novelty 坐标由 LLM 根据 persona 直接打分（0-1），而非人工设定，保证可扩展性。
3. **Conflict Score 计算**：使用 OpenAI embedding 的 cosine distance（归一化到 0-1），而非自定义语义模型，降低复杂度。
4. **Coverage Area**：轨迹点映射到 2D 坐标后，使用 shapely 或自定义凸包算法计算包围面积，再归一化。
5. **辩论 Prompt 工程**：使用 `response_format={"type": "json_object"}`（或 Pydantic schema）强制 LLM 输出结构化 JSON，避免解析错误。

## 运行方式

```bash
cd 黑客松/cognitive-space-api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
uvicorn app.main:app --reload
```

然后访问 `http://localhost:8000/docs` 查看自动生成的 Swagger 文档并测试 API。
