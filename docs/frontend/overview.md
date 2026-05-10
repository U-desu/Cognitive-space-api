# 前端架构概览

> Cognitive Space — 认知空间前端

## 项目定位

前端是「认知空间」系统的用户界面层，负责：
- 用户问题的输入与空间创建
- 多 Agent 认知空间的 3D 可视化交互
- 结构化辩论的实时流式展示
- 用户认知轨迹的统计与分享

## 技术栈

| 层级 | 技术 | 版本 | 职责 |
|------|------|------|------|
| 框架 | React | 18.3.1 | UI 组件库 |
| 语言 | TypeScript | 5.5.4 | 类型安全 |
| 构建 | Vite | 5.4.2 | 开发服务器与打包 |
| 样式 | Tailwind CSS | 3.4.10 | 原子化 CSS |
| 3D 引擎 | Three.js | 0.184.0 | WebGL 渲染 |
| 3D React | @react-three/fiber | 8.18.0 | React 渲染器 |
| 3D 工具 | @react-three/drei | 9.122.0 | Stars, Text, OrbitControls 等 |
| 路由 | react-router-dom | 6.26.0 | SPA 路由 |
| 图标 | lucide-react | 0.460.0 | SVG 图标 |
| Markdown | react-markdown + remark-gfm | 10.1.0 / 4.0.1 | 辩论内容渲染 |

## 目录结构

```
frontend/src/
├── App.tsx                      # 根组件：路由与 Provider 组合
├── main.tsx                     # 入口：ReactDOM 挂载
├── index.css                    # Tailwind + 主题 CSS 变量覆盖
├── api.ts                       # 集中式 API 客户端（REST + SSE）
├── api-types.ts                 # 领域模型 TypeScript 接口
│
├── auth/                        # 认证子系统
│   ├── AuthContext.tsx          # 认证状态 Provider
│   ├── useAuth.ts               # useContext 包装
│   ├── LoginPage.tsx            # 主题化登录/注册页
│   └── AuthModal.tsx            # 登录弹窗（遗留）
│
├── store/
│   └── SpaceContext.tsx         # 空间全局状态（useReducer + Context）
│
├── theme/                       # 全局主题系统
│   ├── ThemeContext.tsx         # 主题状态 Provider（localStorage 同步）
│   ├── themes.ts                # 主题元数据与 CSS 变量映射
│   └── ThemeSwitcher.tsx        # 主题切换下拉 UI
│
├── scene/                       # 3D React-Three-Fiber 场景子系统
│   ├── UniverseScene.tsx        # Canvas 包装器，3D 世界 orchestrator
│   ├── AgentNodes.tsx           # Agent 到 NodeMesh 的映射
│   ├── NodeMesh.tsx             # 单个 3D Agent 节点（头像/球体）
│   ├── NodeLabel.tsx            # 节点下方 billboard 文字标签
│   ├── CenterNode.tsx           # 中央问题球体（太阳）
│   ├── ConnectionLines.tsx      # 父子连线与根-中心实线
│   ├── ConnectionLine.tsx       # 单条 Three.js 线段
│   ├── ParticleTrail.tsx        # 自定义 GLSL 粒子流动效果
│   ├── CameraRig.tsx            # 飞行动画相机 + OrbitControls
│   ├── useLayout3D.ts           # 层级 3D 布局算法 Hook
│   ├── constants.ts             # 场景几何尺寸常量
│   └── layout-config.ts         # 正八面体 + 圆锥布局参数
│
├── components/                  # 页面级与 UI 组件
│   ├── LandingPage.tsx          # 首页：问题输入与热门问题
│   ├── SpacePage.tsx            # 空间详情页：数据加载与 UI 编排
│   ├── AgentPanel.tsx           # 右侧边栏：角色详情/辩论/聚类
│   ├── MetricsHUD.tsx           # 顶部指标条
│   ├── ShareCard.tsx            # 分享报告弹窗
│   ├── LoadingBunny.tsx         # 主题化加载页
│   ├── StreamTurnCard.tsx       # Markdown 辩论回合卡片
│   ├── SpaceCanvas.tsx          # 2D SVG 备用可视化（遗留）
│   ├── SpaceScene.tsx           # 2D SVG 径向树（遗留）
│   └── BackgroundThemeSwitcher.tsx # 旧背景主题切换器（遗留）
│
├── hooks/                       # 自定义 React Hooks
│   ├── useDebateStream.ts       # SSE 辩论流式 Hook
│   ├── useSmoothTypewriter.ts   # rAF 自适应打字机效果
│   └── useTypewriter.ts         # setTimeout 打字机 + 顺序揭示
│
├── utils/                       # 纯工具函数
│   ├── vectors.ts               # Vec3 数学运算
│   └── agent-hierarchy.ts       # 深度计算与子节点映射
│
└── constants/
    └── index.ts                 # 共享颜色、表情、头像路径、哨兵 ID
```

## 设计原则

1. **功能分层**：`scene/` 是自包含的 3D 子系统，与 React DOM 组件严格分离
2. **状态集中**：复杂状态（Space）使用 Reducer 模式，简单状态使用 Context
3. **主题无侵入**：通过 CSS 变量 + Tailwind 类覆盖实现主题切换，不修改业务组件逻辑
4. **3D/2D 并存**：3D 场景是主视图，2D SVG 组件保留但不参与主流程
