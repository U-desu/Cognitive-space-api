# Cognitive Space API — 项目规范与约束

> 本文档记录项目开发中的设计决策、已知问题及全局约束，后续所有修改必须遵循。

---

## 1. 项目结构规范

```
cognitive-space-api/
├── app/                  # 核心业务代码
│   ├── models/           # Pydantic 数据模型（纯数据结构，无业务逻辑）
│   ├── services/         # 业务逻辑（LLM 调用、计算、生成）
│   ├── routers/          # FastAPI 路由（薄层，只负责接收请求和返回响应）
│   ├── config.py         # 环境变量与配置（唯一读取 .env 的地方）
│   ├── store.py          # 数据存储抽象（当前为内存，后续可替换）
│   └── main.py           # FastAPI 入口
├── tests/                # 测试文件
├── plans/                # 实施计划存档（每次 Plan Mode 产出归档于此）
├── docs/                 # API 设计文档、答辩稿
├── SPEC.md               # 本文件：全局约束与规范
└── README.md             # 项目简介与快速开始
```

**约束**：
- 业务逻辑必须写在 `services/` 中，不允许直接写在 router 里
- 环境变量只允许在 `config.py` 中读取，其他模块通过 `from app import config` 引用
- 每次进入 Plan Mode 的产出必须存档到 `plans/` 目录

---

## 2. LLM 调用规范

### 2.1 客户端封装

所有 LLM 调用必须通过 `app/services/llm_client.py`：

```python
from app.services import llm_client

# Chat
raw = llm_client.chat_completion(messages, json_mode=True)

# Embedding
vec = llm_client.get_embedding(text)
```

**禁止**在 service 层直接 `import openai` 或创建客户端实例。

### 2.2 Mock 模式

当 `MOCK_LLM=true` 时，所有 LLM 调用返回预定义数据，不消耗真实 API。

Mock 实现位置：`llm_client.py` 中的 `_mock_chat_completion()` 和 `_mock_embedding()`。

---

## 3. 已知问题与教训

### ❌ 问题 1：Prompt 子串匹配导致 Mock 数据返回错误

**发生时间**：Mock LLM 模式开发阶段
**影响**：`test_create_and_get_space`、`test_compute_edges`、`test_debate` 失败
**根因**：

在 `llm_client.py` 的 mock 函数中，使用子串匹配区分不同调用场景：

```python
# ❌ 错误代码
if "辩论" in prompt_text or "专家 A" in prompt_text or "专家 B" in prompt_text:
    return _MOCK_DEBATE_JSON
```

`space_service.py` 的 system prompt 中包含 `"专家 Agent"`，其中 `"专家 A"` 是其子串，导致空间创建请求被误判为辩论请求，返回了错误的 JSON 结构。

**修复**：使用更精确、更长的关键词匹配：

```python
# ✅ 正确代码
if "辩论主持人" in prompt_text:
    return _MOCK_DEBATE_JSON
```

**约束**：
- **禁止**使用短子串（≤4 个字符或≤2 个词）做 Prompt 内容匹配
- Mock 场景判断必须使用 ≥3 个词的独特关键词，或基于调用方传参区分

### ❌ 问题 2：Python 3.9 类型语法兼容性

**发生时间**：Phase 1 基础骨架开发
**根因**：使用了 Python 3.10+ 的 `X | None` 联合类型语法

```python
# ❌ Python 3.9 不兼容
_client: OpenAI | None = None
```

**修复**：

```python
from typing import Optional
# ✅ Python 3.9 兼容
_client: Optional[OpenAI] = None
```

**约束**：
- 本项目目标 Python 版本为 **3.9+**
- **禁止**使用 `|` 联合类型、`match/case`、参数化泛型内置类型（如 `list[str]` 在 type hint 中）等 3.10+ 语法
- 所有类型注解使用 `typing` 模块：
  - `list[T]` → `List[T]` from `typing`
  - `dict[K,V]` → `Dict[K,V]` from `typing`
  - `X | None` → `Optional[X]`

### ❌ 问题 3：Kimi Code API Key 无法用于通用后端

**发生时间**：API 提供商配置测试
**根因**：Kimi Code（`sk-kimi-` 前缀）的服务端维护 Coding Agent 白名单，非白名单客户端（如自定义 FastAPI 后端）会被拒绝。

**结论**：
- `sk-kimi-` key 仅限 Kimi CLI / Claude Code / Roo Code 等白名单客户端使用
- 本项目需要 **Moonshot 开放平台** 的通用 API Key（`sk-` 开头）

**约束**：
- `.env` 中配置通用 LLM 提供商时，优先使用 OpenAI / Moonshot / DeepSeek 等标准 OpenAI 格式接口
- Kimi Code key 只能用于 Mock 模式或特定 Coding Agent 场景

---

## 4. 测试规范

### 4.1 运行方式

```bash
# 无 API Key — Mock 模式
MOCK_LLM=true python3 -m pytest tests/test_api.py -v

# 有 API Key — 真实调用
python3 -m pytest tests/test_api.py -v
```

### 4.2 测试编写约束

- 测试必须使用 `TestClient`，不允许直接调用 service 函数
- Mock 模式下所有测试必须通过，不允许 `pytest.skip()`
- 每个 API 端点至少有一个端到端测试

---

## 5. 数据模型约束

### 5.1 Pydantic v2

- 使用 Pydantic v2 语法（`model_dump()` 而非 `dict()`，`ConfigDict` 而非内部 `Config` class）
- 但当前代码中有遗留的 `class Config` 用法，逐步迁移中

### 5.2 Enum

- `Stance` enum 使用 `str, Enum` 基类，确保序列化后为字符串值
- 前端接收和数据库（后续）存储均为字符串，不使用整数索引

---

## 6. 依赖管理

`requirements.txt` 中所有包必须指定版本号，避免自动升级导致兼容性问题。

当前核心依赖：
```
fastapi==0.111.0
uvicorn[standard]==0.30.0
pydantic==2.7.0
openai==1.35.0
python-dotenv==1.0.1
httpx==0.27.0
pytest==8.2.0
shapely==2.0.4
```

---

## 7. Git 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
test: 测试相关
refactor: 重构（无功能变更）
chore: 构建/工具链
```

---

## 8. 唯一真相源（OpenAPI Schema）

### 8.1 真相源文件

```
openapi.json                 # 后端 API 唯一真相源（自动导出）
frontend/src/api-types.ts    # 前端 TypeScript 类型（自动生成）
```

### 8.2 同步流程

**每次后端接口变更后，必须执行**：

```bash
# 1. 导出 OpenAPI schema
cd /Users/zhihu/hackathon/cognitive-space-api
MOCK_LLM=true python3 scripts/export-schema.py

# 2. 生成前端类型
python3 scripts/gen-frontend-types.py

# 3. 提交变更
git add openapi.json frontend/src/api-types.ts
git commit -m "sync: update API schema and frontend types"
```

**Plan Mode 中涉及接口变更时**：
- 实施完成后必须运行 `export-schema.py`
- 如果生成了新的 Pydantic 模型，必须运行 `gen-frontend-types.py`
- 将 schema 变更作为 Plan 的一部分记录

### 8.3 前端调用约束

- 前端所有 API 调用必须以 `openapi.json` 为契约
- 禁止手写与 schema 不一致的类型定义
- 前端 fetch/axios 调用路径必须与 `ApiEndpoints` 中定义一致

---

*最后更新：2026-05-02*
