# 移除 Mock 概念 — 完整梳理与迁移计划

> 目标：将"mock"概念从项目中移除，避免与"访客模式"产生概念混淆。
> 
> 原则：mock ≠ 访客。mock 是"无 API key 时的预设数据降级"，访客是"无登录状态"。两者正交，但命名上容易让开发者混淆。

---

## 一、当前系统中所有 Mock 内容清单

### 1. 环境变量 / 配置层

| 变量 | 位置 | 当前默认值 | 实际含义 |
|------|------|-----------|---------|
| `MOCK_LLM` | `services/shared/config.py` | `false` | Generator 是否使用预设数据代替真实 LLM 调用 |
| `COMPUTE_EMBED_BACKEND` | `services/shared/config.py` | `mock` | Compute 嵌入后端选择：`mock` / `local` / `openai` |
| `.env.example` | 根目录 | 同上 | 示例配置 |

### 2. Generator 服务 — LLM Mock

**文件：`services/generator/mock_data.py`（纯数据，196 行）**

| 数据 | 内容 | 用途 |
|------|------|------|
| `ROLE_POOL` | 40 个预设角色（名称、人设、领域、坐标、立场） | Agent 生成时从角色池抽取 |
| `DEBATE_PRESETS` | 3 个完整辩论稿（transcript + synthesis） | 辩论生成时按问题关键词匹配返回 |
| `QUESTION_AGENT_PRESETS` | 3 个问题 × 6 个 Agent 组合 | Agent 生成时按问题关键词匹配返回 |
| `FALLBACK_DEBATES` | 1 个最小化辩论稿 | LLM 调用失败时的降级返回 |

**文件：`services/generator/llm_client.py`（条件逻辑）**

| 函数 | 行为 |
|------|------|
| `_match_preset()` | 关键词匹配 query → 预设问题键 |
| `_generate_mock_agents()` | 从 `QUESTION_AGENT_PRESETS` + `ROLE_POOL` 组装 Agent JSON |
| `_mock_chat_completion()` | 返回 `DEBATE_PRESETS` 或 Agent 预设 JSON |
| `_mock_embedding()` | MD5 hash → 1536 维归一化向量（确定性） |
| `_fallback_debate()` | 返回 `FALLBACK_DEBATES["default"]` |
| `chat_completion()` | 分支：`MOCK_LLM=true` → `_mock_chat_completion()` |
| `get_embedding()` | 分支：`MOCK_LLM=true` → `_mock_embedding()` |

**文件：`services/generator/routers/debates.py`（端点）**

| 端点 | 行为 |
|------|------|
| `POST /generator/debates/fallback` | 直接返回 `FALLBACK_DEBATES["default"]` |

### 3. Compute 服务 — Embedding Mock

**文件：`services/compute/embedder.py`（逻辑 + 数据）**

| 数据/函数 | 内容 |
|-----------|------|
| `_UNIVERSAL_KEYWORDS` | 7 个通用中文关键词（AI、技术、发展…） |
| `_DOMAIN_KEYWORDS` | 37 个领域 × 多个关键词（创业、大厂、投资、教育…） |
| `_mock_embed_semantic()` | jieba 分词 + 领域关键词匹配 → 37 维归一化向量 |
| `embed()` / `embed_batch()` | `COMPUTE_EMBED_BACKEND != "local" && != "openai"` 时默认走 mock |

### 4. Aggregator 服务 — Mock 数据

**文件：`services/aggregator/mock_data.py`（纯数据，106 行）**

| 数据 | 内容 |
|------|------|
| `DOMAIN_LABELS` | 37 个领域标签映射 |
| `ZHIHU_USERS` | 10 个领域 × 3 个模拟知乎大 V |
| `ZHIHU_QUESTIONS` | 3 个问题 × 3 个模拟知乎问题 |
| `HOT_QUESTIONS` | 首页热门问题预设 |

**文件：`services/aggregator/routers/zhihu.py` / `presets.py`**

| 端点 | 数据来源 |
|------|----------|
| `GET /aggregator/zhihu/users` | `ZHIHU_USERS` |
| `GET /aggregator/zhihu/questions` | `ZHIHU_QUESTIONS` |
| `GET /aggregator/presets/hot-questions` | `HOT_QUESTIONS` |
| `GET /aggregator/domain-labels` | `DOMAIN_LABELS` |

### 5. 启动脚本

| 文件 | 行为 |
|------|------|
| `run_mock.sh` | `export MOCK_LLM=true; export COMPUTE_EMBED_BACKEND=mock; exec start-services.sh` |

### 6. 前端

| 文件 | 内容 |
|------|------|
| `frontend/src/components/MetricsHUD.tsx` | 硬编码 fallback 值 `coverage_area = 0.18` |
| `frontend/src/components/SpaceCanvas.tsx` | 注释 `// Mock mode fallback`（空 catch） |
| `frontend/src/api.ts` / `api-types.ts` | 注释说明数据从"frontend mock"迁移到后端 |

### 7. 测试

| 文件 | 依赖 |
|------|------|
| `tests/test_api.py` | 运行时需要 `MOCK_LLM=true` 才能通过（否则调用真实 LLM） |

### 8. 文档 / 计划

| 文件 | Mock 相关内容 |
|------|--------------|
| `plans/mock-llm-plan.md` | Mock LLM 完整设计文档（**可删除**） |
| `docs/generator.md` | Generator mock 架构描述 |
| `docs/compute-module.md` | Compute embedder `mock` 后端描述 |
| `docs/database-migration-plan.md` | 多处引用 mock 数据维度 |
| `docs/database.md` / `database-selection.md` | embedding 维度说明 |
| `README.md` | `MOCK_LLM` 使用说明、run_mock.sh 说明 |
| `stage/end-to-end-demo.py` | 读取 `MOCK_LLM` 和 `COMPUTE_EMBED_BACKEND` |
| `stage/end-to-end-readme.md` | 说明 `MOCK_LLM=false` 用于真实 demo |
| `stage/system-architecture.md` | 架构图标注 embedder 选项含 mock |
| `scripts/export-schema.py` | 注释建议 `MOCK_LLM=true` 运行 |

---

## 二、Mock 内容分类：哪些该移除 / 改名 / 保留

### 类别 A：条件分支逻辑（应移除）

这些是根据 `MOCK_LLM` 或 `COMPUTE_EMBED_BACKEND=mock` 做 if/else 分支的代码。移除后系统必须走真实 API。

| 项 | 移除方式 | 影响 |
|----|---------|------|
| `MOCK_LLM` 环境变量 | 删除 | 运行时必须配置真实 API key |
| `llm_client.chat_completion()` 的 mock 分支 | 删除 if/else | Generator 永远调用真实 LLM |
| `llm_client.get_embedding()` 的 mock 分支 | 删除 if/else | Generator embedding 永远调用真实 API |
| `run_mock.sh` | 删除或重写 | 无 API key 时无法启动 |
| `tests/test_api.py` 对 mock 的隐式依赖 | 需重写测试 | 测试必须配 API key 或使用 test fixtures |

### 类别 B：预设/种子数据（应改名，不叫 mock）

这些本质上是**业务预设数据**或**fallback 降级数据**，与"mock"无关。

| 项 | 建议改名 | 理由 |
|----|---------|------|
| `services/generator/mock_data.py` | `preset_data.py` 或 `seed_data.py` | 角色池、辩论模板是业务种子数据 |
| `services/aggregator/mock_data.py` | `static_data.py` 或 `preset_data.py` | 知乎用户/问题是当前业务数据（无真实 API） |
| `FALLBACK_DEBATES` | `fallback_debates`（保留在 preset_data.py） | LLM 失败时的降级，不是 mock |
| `_mock_embed_semantic()` | `keyword_embed()` 或 `rule_based_embed()` | 基于规则的 embedding，不是 mock |
| `COMPUTE_EMBED_BACKEND=mock` | `keyword` 或 `rule` | 改为描述实际实现方式 |
| `_DOMAIN_KEYWORDS` / `_UNIVERSAL_KEYWORDS` | 保留在 embedder.py | 这是 rule-based embedder 的数据 |

### 类别 C：前端 fallback（应清理或明确语义）

| 项 | 处理方式 |
|----|---------|
| `MetricsHUD.tsx` 硬编码值 | 改为从 trajectory 读取，无数据时显示 `--` 而非假值 |
| `SpaceCanvas.tsx` 注释 | 删除注释或改为 `// Error fallback` |

### 类别 D：文档（应同步更新）

| 项 | 处理方式 |
|----|---------|
| `plans/mock-llm-plan.md` | **删除** |
| `README.md` 中 MOCK_LLM / run_mock.sh | 删除相关段落 |
| `docs/generator.md` mock 章节 | 改为"Preset Data"和"Fallback"章节 |
| `docs/compute-module.md` mock 后端 | 改为"Rule-based Embedding Backend" |
| 其他文档中的 mock 引用 | 同步替换为实际语义 |

---

## 三、迁移方案

### 方案 1：保守迁移（推荐）

保留 preset/fallback 数据，仅移除条件分支和 "mock" 命名。

```
1. 删除环境变量 MOCK_LLM（从 config.py、.env.example 移除）
2. 重命名文件：
   - services/generator/mock_data.py → preset_data.py
   - services/aggregator/mock_data.py → static_data.py
3. 重命名函数/变量：
   - _mock_chat_completion → _preset_chat_completion（或删除）
   - _mock_embedding → _hash_embedding（或删除）
   - _mock_embed_semantic → keyword_embed
   - COMPUTE_EMBED_BACKEND=mock → keyword
4. 保留 FALLBACK_DEBATES（改名为 fallback_debates）
5. 删除 run_mock.sh
6. 删除 plans/mock-llm-plan.md
7. 更新所有 import 和文档引用
8. 测试：配置真实 API key 后运行 pytest
```

**优点**：
- 保留 LLM 失败降级能力（FALLBACK_DEBATES）
- 保留无外部 API 的 Compute embedding（keyword 模式）
- 改动范围可控

**缺点**：
- 运行时必须配置真实 LLM API key（开发成本增加）
- 测试需要真实 API 调用（慢 + 消耗 token）

### 方案 2：激进迁移

完全删除所有 mock 逻辑和 preset 数据，只保留真实 API 路径。

```
1. 删除 MOCK_LLM 及所有分支逻辑
2. 删除 services/generator/mock_data.py（包括 FALLBACK）
3. 删除 services/aggregator/mock_data.py 及路由
4. 删除 _mock_embed_semantic 及 keyword 字典
5. 删除 run_mock.sh
6. 删除 plans/mock-llm-plan.md
```

**优点**：
- 代码最干净，零歧义

**缺点**：
- 开发时必须配 API key
- LLM 失败时无降级（直接 500）
- Aggregator 服务无数据可返回（需立即接入真实 API 或数据库）
- 测试需要真实 API（成本高）

---

## 四、推荐执行顺序

| 阶段 | 任务 | 文件 |
|------|------|------|
| 1 | 删除 `MOCK_LLM` 环境变量及分支 | `config.py`, `.env.example`, `llm_client.py` |
| 2 | 重命名 Compute embed backend `mock` → `keyword` | `config.py`, `embedder.py` |
| 3 | 重命名 generator mock_data → preset_data | `mock_data.py`, `llm_client.py`, `routers/debates.py` |
| 4 | 重命名 aggregator mock_data → static_data | `mock_data.py`, `routers/zhihu.py`, `routers/presets.py` |
| 5 | 删除 `run_mock.sh` | `run_mock.sh` |
| 6 | 删除 `plans/mock-llm-plan.md` | `plans/mock-llm-plan.md` |
| 7 | 更新文档 | `README.md`, `docs/*.md` |
| 8 | 更新测试（配置真实 API key 运行） | `tests/test_api.py` |
| 9 | 清理前端 mock 注释 | `frontend/src/components/*` |
