# 端到端真实 LLM 演示脚本

## 目标
按照 `stage/system-architecture.md` 的业务逻辑流，从用户输入问题开始，每一步调用实际 API，使用**真实 LLM** 生成 Agent、**真实 Embedding** 计算 Edge。

## 前置条件

1. **所有微服务已启动**
   ```bash
   ./scripts/start-services.sh
   ```

2. **环境变量已正确配置**（`.env` 中已配置）
   - `MOCK_LLM=false`
   - `LLM_PROVIDER=deepseek`（或 `openai` / `kimi`）
   - `DEEPSEEK_API_KEY`（或对应的 `OPENAI_API_KEY`）
   - `COMPUTE_EMBED_BACKEND=local`（需 `sentence-transformers`）或 `openai`

3. **Python 依赖已安装**
   ```bash
   pip install requests jieba scikit-learn sentence-transformers
   ```

## 用法

### 交互模式
```bash
python3 stage/end-to-end-demo.py
```

### 直接传入问题
```bash
python3 stage/end-to-end-demo.py "我该辞职去做AI创业吗？"
```

## 脚本流程

```
Step 0: 环境检查
  - 检查 MOCK_LLM=false
  - 检查 Gateway 健康状态

Step 1: 用户输入
  - 选择 1/2/3 对应三个预设热门问题，或自定义输入

Step 2: 认证（Guest 模式）
  - 注册并登录一个随机 demo 用户

Step 3: 问题去重
  - 拉取已有 spaces
  - 使用 jieba + TF-IDF 计算语义相似度
  - 相似度 >= 0.65 则复用已有 Space

Step 4: 创建 Space — 真实 LLM 生成 Agents
  - POST /spaces → Gateway → Generator（LangChain + DeepSeek/OpenAI）→ Core
  - 打印生成的 Agent 列表（立场、领域、summary）

Step 5: 计算 Edge — 真实 Embedding
  - POST /spaces/{id}/edges → Gateway → Compute（sentence-transformers / OpenAI）
  - cosine distance → 冲突分类（fundamental / partial / minor）
  - 打印冲突排行榜

Step 6: 获取 Trajectory
  - GET /spaces/{id}/trajectory
  - 打印认知轨迹初始状态

Step 7: 可选交互
  a. 同步辩论 — 结构化 LLM chain，完整生成后输出
  b. 流式辩论 — SSE 实时逐字输出
  c. Expand Agent — 扩展某个 Agent，生成子节点并重算 Edge

Step 8: 汇总输出
  - 保存完整 Space/Edge/Trajectory 摘要到 stage/output-{space_id}.json
```

## 输出示例

```
============================================================
  认知空间 — 端到端真实 LLM 演示
============================================================

>>> Step 0: 环境检查
  MOCK_LLM=false
  COMPUTE_EMBED_BACKEND=local
  LLM_PROVIDER=deepseek
  Gateway 健康: {'status': 'ok', 'service': 'gateway'}

>>> Step 1: 用户输入
  请选择或输入问题：
    1. 大厂5年了，该辞职去做AI创业吗？
    2. AI发展这么快，程序员会被取代吗？
    3. 30岁该继续深耕技术还是转管理？
    0. 自定义输入
  输入编号: 1
  -> Query: 大厂5年了，该辞职去做AI创业吗？

>>> Step 2: 认证（Guest 模式）
  注册成功: demo_a3f7b2c1
  登录成功: demo_a3f7b2c1 (id=user_xxx)

>>> Step 3: 问题去重
  与历史问题最大相似度: 0.000 (阈值: 0.65)
  未命中历史问题，继续生成

>>> Step 4: 创建 Space — 真实 LLM 生成 Agents
  调用 Generator (LLM_PROVIDER=deepseek) 生成 Agents...
  -> 生成完成，耗时 12.5s
  Space ID: space_8f2a1c3d
  Agents 数量: 5
    - [pro] 创业导师张明 (创业): 大厂背景是优势，AI创业窗口期...
    - [con] 风险投资人李华 (投资): 创业成功率低，建议先副业验证...
    - [neutral] 职业规划师王芳 (人力资源): 需要评估个人风险承受能力...

>>> Step 5: 计算 Edge — 真实 Embedding
  调用 Compute (backend=local) 计算 Edge...
  -> 计算完成，耗时 3.2s
  Edge 数量: 10
  Fundamental: 2 | Partial: 5 | Minor: 3
  推荐辩论的 Edge (fundamental):
    - agent_001 <-> agent_002: 0.823

>>> Step 6: 获取 Trajectory
  Journey Stage: exploration

>>> Step 7: 可选交互
  推荐辩论 Edge: agent_001 vs agent_002
  ...
```

## 注意事项

- **API 成本**：真实 LLM 调用会消耗 DeepSeek / OpenAI 的 API quota
- **首次 Embedding**：`COMPUTE_EMBED_BACKEND=local` 首次运行会自动下载 ~80MB 模型
- **超时**：LLM 生成可能需要 10-30 秒，脚本已设置 120 秒超时
- **认证**：脚本使用 Guest 模式（自动注册随机用户），不会污染你的真实账号
