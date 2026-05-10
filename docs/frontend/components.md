# 组件层

组件按职责分为页面级组件和可复用组件。

---

## 页面级组件

### AgentPanel — 右侧边栏（最复杂组件，~600 行）

三页滑动面板，使用绝对定位 + CSS `transform` 实现页面切换动画。

```
AgentPanel
├── ProfileContent        # 第 1 页：角色详情
│   ├── 头像 + 名称 + stance 标签
│   ├── 人设 + 核心观点
│   ├── 展开探索输入框
│   └── 冲突排行榜（可发起辩论）
├── DebateContent         # 第 2 页：结构化辩论
│   ├── 参与角色头像
│   ├── 流式回合（StreamTurnCard）
│   └── 综合结论（核心冲突 / 建议 / 共识）
└── ClusterContent        # 第 3 页：角色聚类
    ├── 知乎相关问题
    └── 知乎对应用户列表
```

**页面切换**：
- `page: 'profile' | 'debate' | 'cluster'`
- 通过 `translate-x-0 / translate-x-full / -translate-x-full` 实现滑入滑出

**辩论流**：
- 直接使用 `useDebateStream` hook
- 点击「观看他们辩论」→ `setPage('debate')` + `start(spaceId, edgeId, 2)`
- 离开 debate 页自动 `stop()` 关闭 SSE

**扩展节点**：
- 输入提示词 → `api.expandAgent()` → `dispatch({ type: 'APPEND_AGENTS' })`
- 仅追加新 agents，保留已有 edges

**外部数据**：
- 进入 Cluster 页时懒加载知乎用户和问题
- `api.getZhihuUsers(domain)` + `api.getZhihuQuestions(query)`

---

### MetricsHUD — 顶部指标条

横向滚动指标卡片，展示空间的关键统计：

| 指标 | 值 | Tooltip 说明 |
|------|-----|-------------|
| 探索视角 | `N 个` | 围绕问题召唤了多少个不同角色的专家视角 |
| 立场分布 | `✅P ❌C ⚖️N` | 支持派、反对派、中立派各有几人 |
| 认知扩展 | `X%` | 权威-创新二维平面上探索过的区域面积 |
| 探索深度 | `X%` | 基于参与的辩论次数和停留时间计算 |

**实现**：纯展示组件，数据来自 `useSpaceState()`。

---

### ShareCard — 分享报告弹窗

固定遮罩弹窗，展示认知探索的「成绩单」：
- 探索的问题原文
- 三格统计：探索视角数 / 核心冲突数 / 认知扩展百分比
- 认知扩展指数进度条
- 卡片预览（后端生成）
- 一键复制分享语到剪贴板

---

### LoadingBunny — 加载页

空间创建过程中的过渡页面。

**旧版**：粉色兔子 SVG + 琥珀色进度条
**新版（主题化）**：
- 科技脉冲圆环（主题色边框 + 旋转虚线环）
- 主题色渐变进度条（带发光阴影）
- 动态循环文案
- 大脑 emoji 替代兔子

---

## 可复用组件

### StreamTurnCard — 辩论回合卡片

```
StreamTurnCard
├── 角色标签（姿态色背景）
├── 回合类型（argument / rebuttal / synthesis）
├── 打字机动画（条件渲染）
│   ├── ReactMarkdown 渲染内容
│   ├── 打字光标（闪烁竖线）
│   └── 打字中指示器（三个跳动圆点）
└── （已完成的回合直接完整显示）
```

**打字机效果**：
- `useSmoothTypewriter`：基于 `requestAnimationFrame`，自适应每帧字符数
- 最新回合启动打字效果，前一回合自动标记为已完成
- 根据内容长度自动计算完成延迟（最长 8 秒）

---

## 遗留组件

| 组件 | 状态 | 说明 |
|------|------|------|
| `SpaceCanvas.tsx` | 未使用 | 2D Canvas 备用可视化，d3 驱动 |
| `SpaceScene.tsx` | 未使用 | 2D SVG 径向树，独立布局算法 |
| `DebatePanel.tsx` | 未使用 | 独立辩论面板，功能已合并到 AgentPanel |
| `BackgroundThemeSwitcher.tsx` | 未使用 | 旧背景主题切换器，仅切换 3D 背景色 |
| `AuthModal.tsx` | 极少使用 | 弹窗式登录，LoginPage 已替代 |

这些组件保留在代码库中但不参与主流程，3D 场景（`UniverseScene`）是唯一的可视化主视图。
