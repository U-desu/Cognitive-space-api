# Mock LLM 模式 — 启动与测试计划

## 目标

在没有真实 API Key 的情况下，让 Cognitive Space API 后端完整运行，所有 API 端点可调用，测试全通过。

## 核心思路

在 `llm_client.py` 中增加一个 **Mock 分支**。当环境变量 `MOCK_LLM=true` 时，绕过真实的 OpenAI API 调用，直接返回预定义的高质量 JSON 数据。

## 修改清单

### 1. `app/config.py` — 添加 Mock 开关

新增一行：
```python
MOCK_LLM = os.getenv("MOCK_LLM", "false").lower() == "true"
```

### 2. `app/services/llm_client.py` — 插入 Mock 实现

保留原有 OpenAI 调用逻辑不变，在 `chat_completion()` 和 `get_embedding()` 开头增加：

```python
if config.MOCK_LLM:
    return _mock_chat_completion(messages, json_mode)
```

**Mock 数据设计**：

- **`chat_completion`（空间创建）**：返回固定的 3 个 Agent（AI创业者 pro、大厂高管 con、早期投资人 neutral），坐标和摘要与 API 设计文档一致
- **`chat_completion`（辩论触发）**：返回固定的 2 轮辩论记录，含 argument / rebuttal / synthesis
- **`get_embedding`**：基于文本 MD5 hash 生成 1536 维确定性向量，不同文本保证不同向量，cosine distance 计算结果稳定且有意义

### 3. `.env.example` — 增加 Mock 配置选项

```
# 设置为 true 可在无 API Key 时运行演示
MOCK_LLM=true
```

### 4. `tests/test_api.py` — 移除 skip 逻辑

当前测试在 LLM 调用失败时会 `pytest.skip()`。Mock 模式下应该全部通过，因此直接断言状态码 200，不再需要 skip。

### 5. `run_mock.sh` — 一键启动脚本（可选）

```bash
#!/bin/bash
export MOCK_LLM=true
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 测试方式

### 方式一：命令行 pytest

```bash
cd 黑客松/cognitive-space-api
MOCK_LLM=true python3 -m pytest tests/test_api.py -v
```

预期：5 个测试全部通过（health、create+get、edges、trajectory、export）。

### 方式二：Swagger UI 交互测试

```bash
MOCK_LLM=true uvicorn app.main:app --reload
```

打开 `http://localhost:8000/docs`，依次点击：
1. `POST /spaces` → 填入 query → Execute → 拿到 space_id
2. `POST /spaces/{space_id}/edges` → 拿到冲突边
3. `POST /spaces/{space_id}/debates` → 填入 edge_id → 拿到辩论记录
4. `GET /spaces/{space_id}/trajectory` → 拿到认知轨迹
5. `POST /spaces/{space_id}/export` → 拿到导出数据

### 方式三：curl 脚本

```bash
# 1. 创建空间
SPACE=$(curl -s -X POST http://localhost:8000/spaces \
  -H "Content-Type: application/json" \
  -d '{"query":"我是否应该从大厂离职去做AI创业？"}' | jq -r '.space_id')

# 2. 计算冲突边
curl -s -X POST http://localhost:8000/spaces/$SPACE/edges | jq '.space_stats'

# 3. 获取轨迹
curl -s http://localhost:8000/spaces/$SPACE/trajectory | jq '.cognitive_metrics'
```

## 关键设计决策

1. **Mock 数据与真实 Prompt 解耦**：Mock 不解析传入的 messages，直接返回预设数据。这样即使 Prompt 后续调整，Mock 模式依然稳定。
2. **Embedding 确定性**：基于 MD5 hash 生成向量，保证同一文本始终得到同一 embedding，不同文本得到不同向量，cosine distance 计算结果可复现。
3. **零侵入真实逻辑**：Mock 分支仅在最外层 `llm_client.py` 中判断，不影响 `space_service.py`、`debate_service.py`、`edge_service.py` 的业务逻辑。
