# 模型 API 配置指南

> 本文档记录各 LLM 提供商与 Cognitive Space API 后端的兼容性测试结果。

## 已测试的提供商

### 1. OpenAI ✅ 完全兼容

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL_NAME=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
```

| 能力 | 支持 |
|------|------|
| Chat Completion | ✅ |
| JSON Mode | ✅ |
| Embedding | ✅ |

---

### 2. Moonshot AI (Kimi 开放平台) ✅ 完全兼容

> 官网：https://platform.moonshot.cn

```bash
OPENAI_API_KEY=sk-...          # Moonshot 平台 key，sk- 开头
OPENAI_BASE_URL=https://api.moonshot.cn/v1
MODEL_NAME=moonshot-v1-8k
EMBED_MODEL=text-embedding-3-small  # 需确认 Moonshot 是否支持
```

| 能力 | 支持 |
|------|------|
| Chat Completion | ✅ |
| JSON Mode | ✅ |
| Embedding | 需验证 |

---

### 3. Kimi Code 订阅 ❌ 不兼容通用后端

> 官网：https://www.kimi.com/code/console

```bash
# 以下配置无法用于本后端
OPENAI_API_KEY=sk-kimi-...     # Kimi Code key
OPENAI_BASE_URL=https://api.kimi.com/coding/v1
MODEL_NAME=kimi-for-coding
```

**测试结果**：

| 能力 | 支持 | 备注 |
|------|------|------|
| Chat Completion | ❌ | 403：`Kimi For Coding is currently only available for Coding Agents` |
| Embedding | ❌ | 端点不提供 |
| Anthropic SDK | ⚠️ | 仅兼容 Anthropic SDK 格式，但仍有客户端白名单限制 |

**根因**：Kimi Code 服务端维护了一个 Coding Agent 白名单（Kimi CLI, Claude Code, Roo Code, Kilo Code 等），非白名单客户端会被拒绝。

---

### 4. DeepSeek ⚠️ 预计兼容

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.deepseek.com/v1
MODEL_NAME=deepseek-chat
EMBED_MODEL=text-embedding-3-small  # 需验证
```

---

### 5. 智谱 AI (Zhipu) ⚠️ 预计兼容

```bash
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
MODEL_NAME=glm-4
EMBED_MODEL=embedding-3  # 需验证
```

---

## 推荐配置

### 黑客松快速启动（最低成本）

```bash
# 方案 A：OpenAI
OPENAI_API_KEY=sk-...
MODEL_NAME=gpt-4o-mini

# 方案 B：Moonshot（国内）
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.moonshot.cn/v1
MODEL_NAME=moonshot-v1-8k
```

### 生产环境

- **Chat**：gpt-4o / moonshot-v1-128k / deepseek-chat
- **Embedding**：text-embedding-3-small（OpenAI）或本地部署的 BGE 模型
- **存储**：Redis / PostgreSQL 替换内存存储

---

## Embedding 替代方案

如果使用的 LLM 提供商不支持 embedding，可采用以下替代：

1. **LLM 评估法**：直接让 LLM 给两个 Agent 观点的冲突程度打分（0-1）
2. **本地模型**：使用 `sentence-transformers` 加载 BGE 等轻量模型
3. **关键词重叠**：基于 TF-IDF / Jaccard 的文本相似度（精度低但零成本）
