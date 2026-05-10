# 数据流

## 核心用户旅程数据流

```
┌─────────────┐
│  LandingPage │
└──────┬──────┘
       │ 用户输入问题
       ▼
┌─────────────────┐
│ api.createSpace │  POST /spaces
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ LoadingBunny    │────▶│ 最少 2.2s    │  加载动画 + 进度条
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐
│ dispatch        │  SET_SPACE
│ SET_SPACE       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ navigate        │  /space/{spaceId}
│ /space/{id}     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   SpacePage     │
└────────┬────────┘
         │
         ├──▶ api.getSpace(id)        ──▶ dispatch SET_SPACE
         ├──▶ api.computeEdges(id)    ──▶ dispatch SET_EDGES
         └──▶ api.getTrajectory(id)   ──▶ dispatch SET_TRAJECTORY
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                     SpaceContext State                   │
│  { space, edges, debate, trajectory, loading, error }   │
└─────────────────────────────────────────────────────────┘
         │
    ┌────┼────┬────────┐
    ▼    ▼    ▼        ▼
┌─────┐┌───┐┌────────┐┌─────────┐
│Universe││Agent││Metrics ││ShareCard│
│Scene   ││Panel││HUD     ││         │
└─────┘└───┘└────────┘└─────────┘
```

---

## 空间页内部交互流

### 1. 点击 Agent 节点

```
User clicks NodeMesh
  ↓
NodeMesh onClick → onAgentClick(agent_id)
  ↓
SpacePage handleAgentClick(agentId)
  ├── setSelectedAgent(agentId)
  ├── setViewMode('focus')
  └── setAgentClickCount(c => c + 1)   // 强制 AgentPanel remount
  ↓
UniverseScene
  ├── targetPosition = positions.get(agentId)
  ├── CameraRig 飞行动画开始
  └── highlightSet = { agent, parent, children }
  ↓
AgentPanel 重新挂载（key={agentClickCount}）
  ├── page = 'profile'（默认）
  └── 加载角色详情
```

### 2. 发起辩论

```
User clicks "观看他们辩论" on conflict edge
  ↓
AgentPanel handleDebate(edge)
  ├── setSelectedEdgeForDebate(edge)
  ├── setPage('debate')
  └── start(spaceId, edgeId, 2)   // useDebateStream.start()
  ↓
useDebateStream
  ├── loading = true
  ├── fetch POST /debates/stream
  └── 逐事件解析 SSE
  ↓
每收到一个 turn 事件
  ├── turns.push(newTurn)
  └── StreamTurnCard 渲染（最新回合触发打字机）
  ↓
收到 synthesis 事件
  └── synthesis = {...}
  ↓
收到 done 事件
  └── done = true, loading = false
```

### 3. 扩展节点

```
User inputs expand hint → clicks "展开"
  ↓
AgentPanel handleExpand()
  ├── expandLoading = true
  └── api.expandAgent(spaceId, agentId, { query_hint, num_agents: 2 })
  ↓
Backend generates new agents
  ↓
AgentPanel
  ├── extract newAgents (filter existingIds)
  ├── dispatch APPEND_AGENTS({ agents: newAgents })
  └── expandLoading = false
  ↓
SpaceContext reducer
  └── state.space.agents = [...old, ...newAgents]
  ↓
UniverseScene
  ├── agents changed → useLayout3D recalculates
  └── new nodes animate in (scale 0 → 1)
```

---

## 状态变化传播路径

### SET_SPACE（创建/切换空间）

```
SpacePage useEffect
  → dispatch SET_SPACE
    → SpaceContext reducer
      → state.space = newSpace
      → state.edges = []          (重置)
      → state.debate = null       (重置)
      → state.trajectory = null   (重置)
    → 订阅组件重渲染：
      UniverseScene    → 新 agents → 重新布局
      MetricsHUD       → 新统计
      AgentPanel       → 若打开则关闭（agentId 可能失效）
```

### SET_EDGES（边计算完成）

```
SpacePage useEffect
  → dispatch SET_EDGES
    → state.edges = newEdges
    → UniverseScene    → 无直接影响（连线基于 agents 关系）
    → AgentPanel       → relatedEdges 重新计算 → 冲突排行榜更新
```

### APPEND_AGENTS（扩展节点）

```
AgentPanel handleExpand
  → dispatch APPEND_AGENTS
    → state.space.agents = [...old, ...new]
    → UniverseScene    → useLayout3D 重新计算所有位置
    → MetricsHUD       → 探索视角数增加
```

---

## 主题切换数据流

```
User clicks ThemeSwitcher dropdown
  → selects a theme
    → setTheme(themeId)
      → ThemeContext state update
      → useEffect fires
        ├── document.documentElement.setAttribute('data-theme', themeId)
        └── localStorage.setItem('cognitive-theme', themeId)
      → 所有订阅 useTheme 的组件重渲染
        ├── LandingPage    → ThemeGlow 颜色变化
        ├── LoginPage      → TechBackground 颜色变化
        ├── LoadingBunny   → 颜色变化
        ├── UniverseScene  → gl.setClearColor(themeColor)
        └── CenterNode     → 材质颜色变化
      → CSS 属性选择器激活
        ├── 数百条颜色覆盖生效
        └── 0.35s transition 产生平滑变色
```

**关键**：主题切换不触发任何业务逻辑重算，纯视觉层变化。
