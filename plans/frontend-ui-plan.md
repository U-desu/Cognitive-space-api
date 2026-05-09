# 前端界面 — 科技感认知空间可视化

## 目标

基于后端 OpenAPI 真相源，构建一个具有科技感审美的 React 前端，完整展示认知空间的创建、可视化、辩论、轨迹追踪全流程。

## 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 框架 | **React 18 + TypeScript** | 类型安全，组件化，与后端 `api-types.ts` 天然对齐 |
| 构建工具 | **Vite** | 秒级启动，HMR 热重载，比 CRA 轻量 |
| 样式 | **Tailwind CSS** | 原子化 CSS，深色主题切换方便 |
| 可视化 | **D3.js + React** | 散点图、连线、轨迹动画完全可控 |
| 状态管理 | **React Context + useReducer** | 黑客松场景足够，无需引入 Redux |
| 图标 | **Lucide React** | 轻量、科技感的线条图标 |
| HTTP | **原生 fetch** | 接口简单，无需 axios 额外依赖 |

## 科技感设计系统

### 色彩（深色主题）
```
Background:   #0a0a0f  (深空黑)
Surface:      #12121a  (面板背景)
Border:       #1e1e2e  (边框)
Text Primary: #e2e8f0  (主文字)
Text Muted:   #64748b  (次要文字)
Accent Cyan:  #06b6d4  (强调色 / pro 立场)
Accent Magenta: #d946ef  (冲突边高亮)
Accent Amber: #f59e0b  (neutral 立场)
Accent Red:   #ef4444  (con 立场)
Grid:         rgba(6, 182, 212, 0.08)  (网格线)
```

### 视觉元素
- **网格背景**：CSS `background-image: linear-gradient(...)` 细网格
- **发光边框**：`box-shadow: 0 0 20px rgba(6, 182, 212, 0.15)`
- **节点脉冲**：Agent 节点 hover 时带呼吸动画
- **轨迹流光**：用户路径用虚线动画（`stroke-dasharray` + `@keyframes`）

## 页面与组件

### 路由结构（单页应用，URL 驱动状态）

```
/                 → Landing 页（问题输入）
/space/:spaceId   → 认知空间可视化页
```

### 组件清单

| 组件 | 职责 | 对应 API |
|------|------|----------|
| `QueryInput` | 问题输入 + 创建空间按钮 | `POST /spaces` |
| `SpaceCanvas` | 散点图主画布（D3 SVG） | `GET /spaces/:id` |
| `AgentNode` | 单个 Agent 节点（圆点 + tooltip） | 本地渲染 |
| `EdgeLine` | 冲突边连线（粗细=冲突强度） | `POST /spaces/:id/edges` |
| `DebatePanel` | 侧边栏/弹窗展示辩论记录 | `POST /spaces/:id/debates` |
| `TrajectoryOverlay` | 用户探索轨迹动画 | `GET /spaces/:id/trajectory` |
| `MetricsHUD` | 顶部 HUD 展示认知扩展指数 | `GET /spaces/:id/trajectory` |
| `ShareCard` | 导出分享卡片 | `POST /spaces/:id/export` |

### 核心交互流程

```
1. 用户输入问题 → QueryInput
   ↓ POST /spaces
2. 后端返回 Space（含 3 个 Agent）
   ↓
3. SpaceCanvas 渲染散点图
   - 每个 Agent 根据 (authority, novelty) 定位
   - pro=青色, con=红色, neutral=琥珀色
   ↓ POST /spaces/:id/edges
4. 冲突边渲染（连线粗细 ∝ conflict_score）
   - score > 0.7 的边显示为虚线+脉冲
   - 点击边 → 触发辩论
   ↓ POST /spaces/:id/debates
5. DebatePanel 滑出，展示多轮辩论
   - 双方论点左右分栏
   - Synthesis 在底部高亮显示
   ↓ GET /spaces/:id/trajectory
6. 轨迹层叠加，coverage_area 实时计算
   - 已访问节点高亮
   - 凸包面积随探索逐渐填充
```

## 目录结构

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── src/
    ├── main.tsx              # React 入口
    ├── App.tsx               # 路由 + 全局布局
    ├── index.css             # Tailwind + 深色主题变量
    ├── api-types.ts          # ← 后端同步，只读
    ├── api.ts                # fetch 封装，返回类型化 Promise
    ├── store/
    │   └── SpaceContext.tsx  # 空间状态管理
    ├── components/
    │   ├── QueryInput.tsx
    │   ├── SpaceCanvas.tsx   # D3 SVG 主画布
    │   ├── AgentNode.tsx
    │   ├── EdgeLine.tsx
    │   ├── DebatePanel.tsx
    │   ├── TrajectoryOverlay.tsx
    │   ├── MetricsHUD.tsx
    │   └── ShareCard.tsx
    └── hooks/
        └── useSpace.ts       # 空间 CRUD hooks
```

## 关键实现决策

1. **D3 在 React 中的组织方式**：
   - `SpaceCanvas` 使用 `useRef` + `useEffect` 管理 SVG
   - D3 负责计算坐标和绘制，React 负责数据流和事件绑定
   - 不引入 `react-d3` 等封装库，保持控制力

2. **坐标映射**：
   - SVG viewBox = `"0 0 1000 1000"`
   - authority (0~1) → x (100~900)
   - novelty (0~1) → y (900~100)（SVG y 轴向下，需要翻转）

3. **Mock 模式兼容**：
   - 前端 `.env` 配置 `VITE_API_BASE_URL=http://localhost:8000`
   - 启动顺序：先启动后端 `./start-services.sh`，再启动前端 `npm run dev`

4. **类型契约**：
   - 所有 API 响应必须 `as` 成 `api-types.ts` 中的接口
   - 禁止手写与 schema 不一致的类型

## 实现步骤

### Phase 1: 项目骨架（15 min）
1. `npm create vite@latest frontend -- --template react-ts`
2. 安装依赖：`tailwindcss`, `postcss`, `autoprefixer`, `d3`, `@types/d3`, `lucide-react`
3. 配置 Tailwind 深色主题 + 自定义颜色变量

### Phase 2: API 层（10 min）
1. 复制 `api-types.ts` 到 `frontend/src/`
2. 编写 `api.ts`，封装 `fetch` 调用所有 8 个端点

### Phase 3: 核心画布（40 min）
1. `SpaceCanvas.tsx`：SVG 画布 + 坐标轴 + 网格
2. `AgentNode.tsx`：可交互的圆点节点
3. `EdgeLine.tsx`：动态粗细的连线
4. `TrajectoryOverlay.tsx`：路径动画层

### Phase 4: 交互面板（30 min）
1. `QueryInput.tsx`：创建空间入口
2. `DebatePanel.tsx`：辩论记录展示
3. `MetricsHUD.tsx`：认知扩展指数 HUD
4. `ShareCard.tsx`：导出卡片

### Phase 5: 组装与测试（15 min）
1. `App.tsx` 组装路由和状态
2. 端到端测试：创建空间 → 查看散点图 → 点击边触发辩论 → 查看轨迹

## 运行方式

```bash
# 1. 启动后端（已存在）
cd /Users/zhihu/hackathon/cognitive-space-api
./start-services.sh

# 2. 启动前端（新创建）
cd /Users/zhihu/hackathon/cognitive-space-api/frontend
npm install
npm run dev

# 访问 http://localhost:5173
```
