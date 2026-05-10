# 状态管理

前端使用三层状态架构：认证、空间、主题，分别对应三个独立的 React Context。

---

## 1. 认证状态 — `auth/AuthContext.tsx`

**模式**：React Context + `useState`

**状态结构**：
```ts
interface AuthState {
  user: User | null    // 当前用户信息
  loading: boolean     // 初始化加载中
}
```

**设计特点**：
- **访客降级模式**：若 `api.getMe()` 返回空或报错，自动创建访客用户（`user_id: 'guest'`, `username: '访客'`），不强制要求登录
- Cookie-based 会话：`credentials: 'include'` 自动携带会话 Cookie

**Actions**：
| 方法 | 说明 |
|------|------|
| `login(username, password)` | 本地认证登录 |
| `register(username, password, email?)` | 注册新账号 |
| `logout()` | 清除会话 |
| `refresh()` | 重新获取当前用户信息 |

**初始化流程**：
```
组件挂载 → api.getMe()
  ├─ 成功 → 设置 user
  └─ 失败 → 自动创建 guest 用户 → 设置 user
```

---

## 2. 空间状态 — `store/SpaceContext.tsx`

**模式**：React Context + `useReducer`（显式 Action 类型）

**状态结构**：
```ts
interface State {
  space: Space | null       // 空间数据（含 agents）
  edges: Edge[]             // 冲突边关系
  debate: Debate | null     // 当前辩论
  trajectory: Trajectory | null  // 用户认知轨迹
  loading: boolean
  error: string | null
}
```

**Action 设计**：
| Action | Payload | 行为 |
|--------|---------|------|
| `SET_SPACE` | `Space` | 设置空间，同时重置 edges/debate/trajectory |
| `SET_EDGES` | `Edge[]` | 设置冲突边 |
| `SET_DEBATE` | `Debate` | 设置辩论数据 |
| `SET_TRAJECTORY` | `Trajectory` | 设置认知轨迹 |
| `SET_LOADING` | `boolean` | 加载状态 |
| `SET_ERROR` | `string` | 错误信息 |
| `APPEND_AGENTS` | `{ agents, edges? }` | 扩展节点后追加新 agents（保留已有 edges） |

**为什么用 Reducer**：
- Space 状态有多个相关字段，单一 `useState` 会导致更新分散
- `SET_SPACE` 需要级联重置其他字段，Reducer 保证原子性
- `APPEND_AGENTS` 需要不可变合并，Reducer 明确表达意图

**消费方**：
`SpacePage`, `AgentPanel`, `MetricsHUD`, `ShareCard`, `UniverseScene` 等几乎所有空间相关组件。

---

## 3. 主题状态 — `theme/ThemeContext.tsx`

**模式**：React Context + `useState` + `localStorage` + DOM 副作用

**状态**：
```ts
type ThemeId = 'cyberpunk' | 'deepspace' | 'matrix'
```

**持久化**：
- 读取：`localStorage.getItem('cognitive-theme')`
- 写入：`localStorage.setItem('cognitive-theme', theme)`
- 默认：`cyberpunk`

**DOM 副作用**：
```ts
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme)
}, [theme])
```

通过 `data-theme` 属性激活 CSS 属性选择器，实现零 JS 样式注入的主题切换。

**主题定义**（`themes.ts`）：
```ts
THEMES = [
  { id: 'cyberpunk', name: '霓虹迷城', accent: '#00f0ff' },
  { id: 'deepspace', name: '星际认知', accent: '#3b82f6' },
  { id: 'matrix',     name: '神经织网', accent: '#00ff88' },
]
```

**为什么独立 Context**：
- 主题需要包裹登录页（未认证状态也需要主题）
- 与 Space 状态生命周期不同（主题跨页面持久）
- 避免 SpaceProvider 重新渲染时触发主题重算
