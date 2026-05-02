# 3D 认知空间可视化计划

## 目标

将当前的 2D SVG 散点图升级为 **3D 球体空间可视化**，解决分布不均匀、线条辨识度低、屏幕利用率不足的问题。

## 核心需求

1. **均匀分布**：节点均匀分布在球面上，视觉对称
2. **高辨识度线条**：连线用 3D 空间中的发光管线，颜色区分冲突类型
3. **屏幕利用率**：球体可旋转，始终充满视口
4. **交互**：中心点固定，鼠标拖动旋转整个空间
5. **不绑定数值**：连线长度与 conflict_score 无关，只保留颜色和粗细语义

## 技术方案

| 组件 | 选择 | 理由 |
|------|------|------|
| 3D 引擎 | **React Three Fiber (@react-three/fiber)** | React 原生集成，声明式 3D，与现有代码风格一致 |
| 辅助库 | **@react-three/drei** | OrbitControls、Text、Line、Sphere 等现成组件 |
| 分布算法 | **Fibonacci Sphere** | 球面均匀分布，N 个节点始终对称 |
| 连线 | **drei `<Line>`** | 3D 空间中的发光线条，支持粗细和颜色 |
| 节点 | **drei `<Sphere>` + `<Text>`** | 3D 球体节点，Billboard 文字始终面向相机 |

## 3D 空间设计

### 节点布局：球面均匀分布

```
 authority/novelty  →  θ (方位角) + φ (极角)
 stance             →  节点颜色
 confidence         →  节点大小
```

**Fibonacci Sphere 算法**：
```typescript
function fibonacciSphere(n: number, radius: number): [number, number, number][] {
  const points: [number, number, number][] = []
  const phi = Math.PI * (3 - Math.sqrt(5)) // golden angle
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2  // y 从 1 到 -1
    const r = Math.sqrt(1 - y * y)    // 当前层的半径
    const theta = phi * i              // golden angle 增量
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    points.push([x * radius, y * radius, z * radius])
  }
  return points
}
```

效果：无论 5 个还是 8 个节点，都均匀分布在球面上，间距几乎相等。

### 连线设计

- **形状**：3D 空间中两点之间的直线（最短路径穿过球体内部）
- **颜色**：
  - fundamental → 洋红色 `#d946ef`，发光
  - partial → 青色 `#06b6d4`
  - minor → 不显示（过滤掉）
- **粗细**：与 conflict_score 成正比（视觉提示，但不影响长度）
- **发光效果**：`drei` 的 `<Line>` 配合 `lineWidth` + post-processing bloom

### 交互

- **OrbitControls**：鼠标左键拖动旋转，滚轮缩放，右键平移
- **中心固定**：相机始终看向原点 `(0,0,0)`
- **悬浮节点**：节点放大 + 显示 tooltip
- **点击连线**：触发辩论（同现有逻辑）

### 背景与氛围

- 深色背景 + 星空粒子（drei `<Stars>`）
- 球体中心放一个半透明的参考球（wireframe）
- 节点自带点光源（`<pointLight>`），形成发光效果

## 组件重构

`SpaceCanvas.tsx` → `SpaceScene.tsx`

```
SpaceScene
├── <Canvas> (R3F 画布)
│   ├── <OrbitControls>          # 鼠标旋转控制
│   ├── <Stars>                  # 星空背景
│   ├── <ambientLight>           # 环境光
│   ├── <pointLight>             # 中心光源
│   ├── <Sphere wireframe>       # 参考球（半透明）
│   ├── <ConnectionLines>        # 所有连线
│   │   └── <Line> × N           # 每条冲突边
│   ├── <AgentNodes>             # 所有节点
│   │   └── <AgentNode> × N      # 每个 Agent
│   │       ├── <Sphere>         # 球体
│   │       ├── <pointLight>     # 自发光
│   │       └── <Billboard><Text> # 名字标签
│   └── <Html>                   # 悬浮 tooltip（HTML 层）
```

## 实现步骤

### Phase 1: 安装依赖（5 min）
```bash
cd frontend
npm install @react-three/fiber @react-three/drei three @types/three
```

### Phase 2: 3D 场景骨架（20 min）
1. 创建 `SpaceScene.tsx`，替换 `SpaceCanvas`
2. 配置 `<Canvas>` + `<OrbitControls>` + `<Stars>`
3. 验证球体可拖动旋转

### Phase 3: 节点与连线（30 min）
1. Fibonacci Sphere 分布函数
2. `<AgentNode>` 组件（Sphere + Text + pointLight）
3. `<ConnectionLine>` 组件（drei `<Line>`）
4. 按 conflict_score 过滤 minor 边

### Phase 4: 交互与 Tooltip（20 min）
1. 节点 hover 放大 + tooltip
2. 连线 hover 高亮 + tooltip（HTML `<Html>` overlay）
3. 点击连线触发辩论

### Phase 5: 替换与测试（15 min）
1. `SpacePage.tsx` 中替换 `<SpaceCanvas>` 为 `<SpaceScene>`
2. 端到端测试：创建空间 → 旋转 → 点击边 → 辩论

## 运行方式

```bash
# 后端已在运行
# 前端重新安装依赖后启动
cd /Users/zhihu/hackathon/cognitive-space-api/frontend
npm install @react-three/fiber @react-three/drei three @types/three
npm run dev
```

## 关键设计决策

1. **球面分布 vs 自由 3D 坐标**：球面分布保证均匀性和对称性，自由坐标会回到密集问题
2. **连线穿球 vs 球面弧线**：直线穿过球体内部，视觉上更有"空间感"；球面弧线会遮挡节点
3. **相机位置**：初始相机在 `[0, 0, 4]`，始终看向原点，OrbitControls 自动处理旋转
