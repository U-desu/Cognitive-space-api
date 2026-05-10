# API 层与数据类型

## API 客户端 — `api.ts`

轻量级手写 REST 客户端，基于原生 `fetch`。

**基础配置**：
- Base URL: `import.meta.env.VITE_API_BASE_URL || ''`
- Auth: `credentials: 'include'`（Cookie 会话）
- 请求头自动设置 `Content-Type: application/json`

**封装模式**：
```ts
async post<T>(path: string, body: unknown): Promise<T>
async get<T>(path: string): Promise<T>
```

两个辅助函数统一处理 JSON 序列化、响应解析和错误抛出（非 2xx 状态码抛出包含错误详情的 Error）。

## 端点清单

### Core 服务（端口 8001，经 Gateway 8000 代理）

| 方法 | 端点 | 用途 | 返回 |
|------|------|------|------|
| POST | `/spaces` | 创建认知空间 | `Space` |
| GET | `/spaces/{id}` | 获取空间详情 | `Space` |
| POST | `/spaces/{id}/edges` | 计算冲突边 | `{ edges: Edge[] }` |
| POST | `/spaces/{id}/debates` | 创建辩论 | `Debate` |
| GET | `/spaces/{id}/debates/stream` | **SSE 流式辩论** | 事件流 |
| GET | `/spaces/{id}/trajectory` | 用户认知轨迹 | `Trajectory` |
| POST | `/spaces/{id}/export` | 导出分享卡片 | 报告数据 |
| GET | `/spaces/my` | 用户空间列表 | `Space[]` |
| POST | `/spaces/{id}/agents/{aid}/expand` | 扩展 Agent 子树 | `Space`（含新 agents）|

### Auth 服务

| 方法 | 端点 | 用途 |
|------|------|------|
| GET | `/auth/github/authorize` | 获取 GitHub OAuth URL |
| POST | `/auth/register` | 注册 |
| POST | `/auth/login` | 登录 |
| GET | `/auth/me` | 当前用户 |
| POST | `/auth/logout` | 登出 |

### Aggregator 服务

| 方法 | 端点 | 用途 | 返回 |
|------|------|------|------|
| GET | `/aggregator/zhihu/users` | 知乎相关用户 | `ExternalUser[]` |
| GET | `/aggregator/zhihu/questions` | 知乎相关问题 | `ExternalQuestion[]` |
| GET | `/aggregator/presets/hot-questions` | 首页热门预设 | `HotQuestionPreset[]` |
| GET | `/aggregator/domain-labels` | 领域标签映射 | `Record<string, string>` |

## SSE 流式接口

辩论生成使用 Server-Sent Events，前端通过 `fetch` + `ReadableStream` 手动解析（而非 `EventSource`），因为需要支持 POST 请求体。

**事件格式**：
```
event: turn
data: { "round": 1, "agent": "...", "content": "...", "type": "argument" }

event: synthesis
data: { "core_conflict": "...", "resolution_suggestion": "...", "agreement_points": [...] }

event: done
data: {}
```

**解析逻辑**（`useDebateStream.ts`）：
1. 创建 `AbortController` 用于取消
2. `response.body.getReader()` 获取流读取器
3. `TextDecoder` 逐块解码
4. 按行解析，识别 `event:` 和 `data:` 前缀
5. 根据 event type 分发到对应状态字段

## 数据类型 — `api-types.ts`

核心领域模型（自动/半自动生成，顶部注释 "DO NOT EDIT MANUALLY"）：

```ts
interface Space {
  space_id: string
  query: string
  user_id: string
  agents: Agent[]
  created_at: string
}

interface Agent {
  agent_id: string
  name: string
  stance: 'pro' | 'con' | 'neutral'
  persona: string
  summary: string
  domain?: string
  parent_id?: string
  position: { authority: number; novelty: number }
}

interface Edge {
  edge_id: string
  source: string
  target: string
  conflict_score: number
  conflict_type: 'fundamental' | 'partial' | 'minor'
  divergence_axes: Array<{ axis: string; score: number }>
  debate_recommended: boolean
}

interface Debate {
  debate_id: string
  space_id: string
  edge_id: string
  rounds: DebateRound[]
  synthesis?: Synthesis
}

interface Trajectory {
  space_id: string
  user_id: string
  visited_agents: string[]
  debates_viewed: string[]
  cognitive_metrics: Record<string, number>
}
```

## Vite 代理配置

```ts
// vite.config.ts
server: {
  proxy: {
    '/spaces': 'http://localhost:8000',
    '/auth': 'http://localhost:8000',
    '/health': 'http://localhost:8000',
    '/aggregator': 'http://localhost:8000',
    '/generator': 'http://localhost:8000',
    '/compute': 'http://localhost:8000',
  }
}
```

开发环境所有 API 请求经 Vite 代理转发到 Gateway（8000），避免 CORS 问题。
