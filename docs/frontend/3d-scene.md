# 3D 场景架构

3D 场景是认知空间的核心可视化，使用 React Three Fiber（R3F）构建，完全替代了早期的 2D SVG 实现。

## 整体结构

```
UniverseScene.tsx          # Canvas 包装器 + HTML 叠加层
├── SceneBackground         # 动态设置 renderer clearColor
├── ambientLight            # 环境光 (intensity 0.4)
├── pointLight × 2          # 主光源 + 补光
├── Stars (drei)            # 星空背景（Suspense 包裹）
├── CenterNode              # 中央问题球体
├── AgentNodes              # 所有 Agent 节点
│   └── NodeMesh × N        # 单个 Agent 3D 表现
│       ├── circleGeometry   # 白色圆形背景
│       ├── planeGeometry    # 头像纹理
│       ├── ringGeometry     # 姿态色边框
│       └── NodeLabel        # billboard 文字标签
├── ConnectionLines         # 层级连线
│   ├── ConnectionLine      # 父子虚线
│   ├── ConnectionLine      # 根-中心实线
│   └── ParticleTrail       # 高亮时金色粒子流动
├── CameraRig               # 飞行动画相机
└── BackgroundMesh          #  invisible 点击捕获球
```

## UniverseScene — 场景 orchestrator

**职责**：
- 创建全视口 `<Canvas>`
- 根据节点分布计算相机距离
- 管理场景级状态：`hoveredAgent`, `highlightedId`
- 渲染 HTML 叠加层：返回按钮、提示文字、AgentTooltip
- 动态设置背景色随主题变化

**相机距离算法**：
```ts
const cameraDistance = Math.max(28, maxDist * 1.5)
// maxDist: 所有 agent 位置到原点最大距离
// 保证最小距离 28，确保所有节点可见
```

**聚焦目标**：
- 选中 Agent → 该 Agent 的 3D 坐标
- 选中中心（用户）→ `[0, 0, 0]`
- 全局视图 → `null`（相机返回默认位置）

---

## 布局算法 — `useLayout3D.ts`

**核心思路**：正八面体根节点 + 父方向圆锥偏移

### 第 0 层（根节点）
- 固定在正八面体 6 个顶点
- 相邻根方向夹角 90°
- 半径 `ROOT_RADIUS = 30`

### 第 1 层（子节点）
- 沿父节点方向延伸半径 50
- 在垂直于父方向的平面内均匀圆环分布
- 展开系数 `LAYER_SPREAD = 0.28`
- 圆锥半角约 15.6°，全角约 31°

### 第 2 层（孙节点）
- 半径 65，同样模式

### 隔离保证
```
相邻根夹角 = 90°
子节点圆锥全角 ≈ 31°
31° × 2 = 62° < 90°
→ 相邻根的子节点区域天然不重叠
```

### 防碰撞
`enforceMinDistance()`：若任意两节点距离 < 12，沿分离方向微调位置。

### 输出
返回 `Map<string, Vec3>`，key 为 `agent_id`，value 为 `[x, y, z]` 坐标。

---

## 节点渲染 — `NodeMesh.tsx`

### 头像模式（主要）

每个 Agent 节点渲染为 billboard 平面：

```
group (billboard，每帧复制相机四元数)
├── mesh: circleGeometry      # 白色圆形背景，opacity 动态
├── mesh: planeGeometry       # 头像纹理，4.0 × 3.2
├── mesh: ringGeometry        # 姿态色边框环
└── group (条件渲染)
    ├── mesh: sphereGeometry  # 子节点数徽章（白色球 + 文字）
    └── mesh: sphereGeometry  # 展开按钮（🔍）
```

**圆形背景 opacity**：
- 默认：`0.2`
- 悬浮：`0.55`
- 选中：`0.7`

**边框环 opacity**：
- 网络高亮：`0.95`
- 选中：`0.75`
- 悬浮：`0.55`
- 默认：`0.3`

### 入场动画

`scaleAnim` 从 0 线性增长到 1，持续约 30 帧，产生「弹出」效果。

### 回退模式

无头像时渲染彩色球体（`sphereGeometry` + `meshStandardMaterial`）。

---

## 节点标签 — `NodeLabel.tsx`

Billboard 文字标签，位于节点下方 3.5 单位处。

**自适应颜色**：
- 深色背景：`白色文字 + 黑色描边`
- 浅色背景：`黑色文字 + 白色描边`

使用 `@react-three/drei` 的 `<Text>` 组件，通过 `outlineWidth` 和 `outlineColor` 实现描边。

---

## 中央节点 — `CenterNode.tsx`

代表用户问题的「太阳」球体。

```
group
├── mesh: sphereGeometry (radius 3.0)   # 核心球体
│   └── meshStandardMaterial
│       ├── color: 主题 accent 色
│       ├── emissive: 主题 accent 色
│       └── emissiveIntensity: 1.5
├── mesh: sphereGeometry (radius 4.0)   # 辉光外壳
│   └── meshBasicMaterial
│       ├── opacity: 0.1
│       └── blending: AdditiveBlending
├── pointLight                            # 中心光源
└── group (billboard)
    └── Text                              # 截断的问题文字 + 主题 emoji
```

**主题适配**：
- Cyberpunk：青色核心 + 紫色辉光
- DeepSpace：蓝色核心 + 紫色辉光
- Matrix：绿色核心 + 青色辉光

---

## 连线系统 — `ConnectionLines.tsx` + `ConnectionLine.tsx`

### 父子连线
- **样式**：虚线（`lineDashedMaterial`）
- **颜色**：`isDark ? '#e2e8f0' : '#1e293b'`
- **悬浮高亮**：虚线间隔动画加速 + 金色粒子流动

### 根-中心连线
- **样式**：实线（`lineBasicMaterial`）
- **颜色**：根节点的 stance 色
- **透明度**：默认 0.4，选中时 0.7

### 粒子效果 — `ParticleTrail.tsx`

自定义 GLSL ShaderMaterial：

**Vertex Shader**：
- `aOffset` 属性驱动粒子沿线条流动
- `mod(aOffset + uTime * 0.4, 1.0)` 产生循环运动
- `sin(t * 4π)` 垂直抖动（约 2 个周期）

**Fragment Shader**：
- `smoothstep(0, 0.15)` + `smoothstep(1, 0.85)` 两端淡入淡出
- 金色 `#FFD700` 粒子

---

## 相机系统 — `CameraRig.tsx`

基于 `OrbitControls`（drei）扩展飞行动画。

### 交互模式
- **拖拽**：旋转视角（保持目标点）
- **滚轮**：缩放距离
- **双击**：聚焦模式返回全局视图

### 飞行动画

当 `targetPosition` 变化时触发：
1. 记录起始位置、目标位置、方位角、极角
2. `useFrame` 中每帧插值：`easeOutCubic(t)`
3. 保持方位角/极角不变，仅改变距离和目标点
4. 聚焦时 target 向右偏移 10 单位（避开右侧 AgentPanel）

```ts
// easeOutCubic: 先快后慢
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
```

### 聚焦距离
固定 `focusDistance = 38`，保证选中节点在视野中心且大小适中。

---

## 尺寸常量 — `scene/constants.ts`

```ts
AGENT_CIRCLE_RADIUS   = 2.6    // 节点圆形背景半径
CENTER_CIRCLE_RADIUS  = 3.0    // 中心球体半径
AVATAR_PLANE_WIDTH    = 4.0    // 头像平面宽
AVATAR_PLANE_HEIGHT   = 3.2    // 头像平面高（比例 1.25）
BORDER_RING_INNER     = 2.5    // 边框环内径
BORDER_RING_OUTER     = 2.75   // 边框环外径
LABEL_FONT_SIZE       = 1.15   // 标签字体大小
```

头像比例 300×240（1.25）与平面尺寸 4.0×3.2（1.25）精确匹配，无拉伸。
