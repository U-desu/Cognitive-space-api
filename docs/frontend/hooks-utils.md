# Hooks 与工具函数

## Hooks

### useAuth — `auth/useAuth.ts`

```ts
function useAuth(): {
  user: User | null
  loading: boolean
  login: (u: string, p: string) => Promise<void>
  register: (u: string, p: string, e?: string) => Promise<void>
  logout: () => Promise<void>
}
```

AuthContext 的包装器，未在 Provider 内调用会抛错。

---

### useSpaceState — `store/SpaceContext.tsx`

```ts
function useSpaceState(): {
  state: State
  dispatch: React.Dispatch<Action>
}
```

SpaceContext 的包装器，未在 Provider 内调用会抛错。

---

### useTheme — `theme/ThemeContext.tsx`

```ts
function useTheme(): {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
}
```

ThemeContext 的包装器。

---

### useDebateStream — `hooks/useDebateStream.ts`

**职责**：管理 SSE 辩论流的全生命周期。

**状态**：
```ts
interface StreamState {
  turns: StreamTurn[]         // 辩论回合列表
  synthesis: Synthesis | null  // 综合结论
  done: boolean               // 流是否结束
  loading: boolean            // 是否正在连接/接收
  error: string | null        // 错误信息
}
```

**为什么不用 EventSource**：
标准 `EventSource` 只支持 GET 请求，无法携带请求体。后端辩论流需要 POST 请求传递参数，因此使用 `fetch` + `ReadableStream` 手动解析 SSE。

**解析流程**：
```
fetch POST /spaces/{id}/debates/stream
  ↓
response.body.getReader()      // 获取流读取器
  ↓
TextDecoder 逐块解码         // Uint8Array → string
  ↓
按 \n\n 分割事件块
  ↓
每块按行解析：
  event: turn      → 解析 data JSON → turns.push()
  event: synthesis → 解析 data JSON → synthesis = ...
  event: done      → done = true
  ↓
AbortController 取消请求（stop() 或组件卸载）
```

**接口**：
| 方法 | 说明 |
|------|------|
| `start(spaceId, edgeId, rounds)` | 发起 SSE 连接 |
| `stop()` | 中止连接（AbortController.abort）|

---

### useSmoothTypewriter — `hooks/useSmoothTypewriter.ts`

**职责**：自适应打字机效果，根据设备帧率动态调整每帧输出的字符数。

**机制**：
- 基于 `requestAnimationFrame`（比 setTimeout 更平滑）
- 计算每帧时间差 `delta`，根据 `baseSpeed`（默认 18ms/字符）决定本帧输出多少字符
- 支持 CJK 字符识别（中文字符减速）

**返回**：
```ts
{
  displayText: string   // 当前已显示的文本
  isTyping: boolean     // 是否还在打字中
}
```

---

### useTypewriter — `hooks/useTypewriter.ts`

基础版打字机，基于 `setTimeout`：
- 支持逐字/逐词/逐行模式
- CJK 字符延迟加倍
- 提供 `useSequentialReveal` 用于多个元素顺序揭示

**使用场景**：`useSmoothTypewriter` 已替代本 hook 的主流用途，保留用于特定简单场景。

---

### useLayout3D — `scene/useLayout3D.ts`

**职责**：计算所有 Agent 的 3D 坐标。

**返回**：`Map<string, Vec3>` — agent_id → `[x, y, z]`

**缓存**：使用 `useMemo`，仅在 `agents` 数组变化时重新计算。

**算法复杂度**：O(n²)（需要计算每对节点距离进行防碰撞），n 为 agent 数量（通常 < 50）。

---

## 工具函数

### vectors.ts — Vec3 数学

```ts
type Vec3 = [number, number, number]

function normalize(v: Vec3): Vec3
function cross(a: Vec3, b: Vec3): Vec3
function dot(a: Vec3, b: Vec3): number
function distance(a: Vec3, b: Vec3): number
function offsetTowards(origin: Vec3, target: Vec3, distance: number): Vec3
```

纯数学函数，无副作用，用于布局算法中的向量运算。

### agent-hierarchy.ts — 层级计算

```ts
function getDepth(agent: Agent, agents: Agent[]): number
function buildChildrenMap(agents: Agent[]): Map<string, Agent[]>
function useChildrenMap(agents: Agent[]): Map<string, Agent[]>
```

- `getDepth`：沿 `parent_id` 链向上遍历，计算节点深度
- `buildChildrenMap`：O(n) 构建父→子数组映射
- `useChildrenMap`：`useMemo` 包装，避免每次渲染重建

### constants/index.ts — 共享常量

```ts
STANCE_COLORS = { pro: '#4ade80', con: '#fb7185', neutral: '#fbbf24' }
STANCE_EMOJI  = { pro: '✅', con: '❌', neutral: '⚖️' }
USER_AGENT_ID = '__user__'
AVATAR_IMAGES = ['/avatars/极客赌徒.png', ...]  // 36 张
```

集中管理防止颜色/标识在多处定义时产生漂移。
