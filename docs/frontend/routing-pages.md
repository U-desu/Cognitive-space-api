# 路由结构与页面组件

## 路由配置

```tsx
// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/space/:spaceId" element={<SpacePage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```

仅两条有效路由：
- `/` — 首页（LandingPage）
- `/space/:spaceId` — 空间详情页（SpacePage）

## Provider 嵌套层次

```
AuthProvider          # 最外层：认证状态全局可用
└── ThemeProvider     # 主题状态（登录/未登录都包裹）
    └── SpaceProvider # 仅包裹已登录路由
        └── BrowserRouter
            └── Routes
```

## LandingPage — 认知入口

**职责**：用户问题的输入入口，展示热门问题预设。

**状态**：
- `query: string` — 输入框内容
- `loading: boolean` — 提交中状态
- `hotQuestions: HotQuestionPreset[]` — 从 Aggregator 获取的预设问题

**数据流**：
1. 用户输入问题 → `handleSubmit`
2. 调用 `api.createSpace({ query })`
3. 显示 `LoadingBunny` 至少 2.2 秒（最小延迟保证体验）
4. `dispatch({ type: 'SET_SPACE', payload: space })`
5. `navigate(/space/${space.space_id})`

**主题集成**：
- 背景使用 `ThemeGlow` 组件渲染 3 个主题色径向渐变光晕
- Header 包含 `ThemeSwitcher`
- 输入框边框、按钮渐变、徽章边框均随主题 accent 色变化

## SpacePage — 空间详情

**职责**：空间数据加载主控页，编排 3D 场景、侧边栏、指标条、分享弹窗。

**本地状态**：
- `selectedAgent: string | null` — 当前选中 Agent
- `viewMode: 'global' | 'focus'` — 全局视图 / 聚焦视图
- `agentClickCount: number` — 强制 AgentPanel remount 的计数器
- `showShare: boolean` — 分享弹窗显隐
- `resetCameraSignal: number` — 触发相机重置的信号

**数据加载**（`useEffect`）：
```
同时发起：
  api.getSpace(spaceId)      → dispatch SET_SPACE
  api.computeEdges(spaceId)  → dispatch SET_EDGES
  api.getTrajectory(spaceId) → dispatch SET_TRAJECTORY
```

**布局结构**：
```
<div class="min-h-screen flex flex-col">
  <header>        <!-- 问题标题 + 主题切换 + 分享按钮 -->
  <MetricsHUD />  <!-- 探索视角 / 立场分布 / 认知扩展 / 探索深度 -->
  <main>          <!-- 相对定位容器 -->
    <UniverseScene />   <!-- 3D 场景（全高） -->
    <AgentPanel />      <!-- 聚焦时右侧滑出边栏 -->
    <ShareCard />       <!-- 分享弹窗（条件渲染） -->
  </main>
</div>
```

**交互设计**：
- 点击 Agent 节点 → `selectedAgent` + `viewMode='focus'`
- 再次点击同一 Agent → `agentClickCount++` 强制重渲染面板
- AgentPanel 关闭 → `selectedAgent=null` + `viewMode='global'`

## LoginPage — 认证入口

**职责**：登录 / 注册 / GitHub OAuth。

**状态**：
- `mode: 'login' | 'register'` — 切换登录/注册模式
- `username, password, email` — 表单字段
- `error, submitting` — 提交状态

**主题集成**：
- 完全主题化：背景网格线 + 光晕根据主题变化
- 输入框边框、按钮渐变使用主题 accent 色
- 顶部放置 `ThemeSwitcher`
- 移除旧版的粉色动物漂浮背景

## 加载状态页

App.tsx 在 `auth.loading` 时显示极简加载页：
- 大脑 emoji 弹跳动画
- `bg-space-bg` 背景（随主题变化）
