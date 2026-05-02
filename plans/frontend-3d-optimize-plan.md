# 前端可视化优化计划

## 问题诊断

1. **节点密集**：40-role 池的基准坐标集中在 0.2~0.95 区间，线性映射到固定 840px 区域后，8 个节点的平均间距仅约 100px
2. **线条重叠**：所有边都是直线连接，当节点多时每对节点都有连线，视觉上形成密集的"毛线球"
3. **悬浮数值难读**：当前用 SVG `<text>` 显示在连线上方，字体 12px、无背景、可能被节点/其他连线遮挡

## 改进方案

### 1. 节点分布：自适应坐标映射（拉伸到满画布）

**当前**：固定线性映射 `PAD + v * (W - 2*PAD)`

**改进**：
```typescript
// 计算所有节点坐标的实际范围
const authValues = agents.map(a => a.position.authority)
const novValues = agents.map(a => a.position.novelty)
const authMin = Math.min(...authValues) * 0.9  // 留一点边距
const authMax = Math.max(...authValues) * 1.1
const novMin = Math.min(...novValues) * 0.9
const novMax = Math.max(...novValues) * 1.1

// 将实际数据范围拉伸到整个画布
function scaleX(v: number) {
  const t = (v - authMin) / (authMax - authMin)
  return PAD + t * (W - 2 * PAD)
}
function scaleY(v: number) {
  const t = (v - novMin) / (novMax - novMin)
  return H - PAD - t * (H - 2 * PAD)
}
```

效果：无论 5 个还是 8 个节点，都会均匀占满整个画布区域。

### 2. 线条区分：贝塞尔曲线 + 透明度分级

**当前**：所有边都是直线，粗细仅由 conflict_score 决定

**改进**：
- 用二次贝塞尔曲线替代直线，给每条边一个基于 hash 的微小偏移，避免完全重叠
- 只显示 conflict_score > 0.25 的边，过滤掉弱连接
- `opacity = 0.3 + conflict_score * 0.7`，分数越低越透明
- fundamental 冲突用洋红色 + 脉冲动画，partial 用灰色，minor 不显示

```typescript
// 曲线控制点：中点 + 垂直偏移
const mx = (x1 + x2) / 2
const my = (y1 + y2) / 2
const dx = x2 - x1
const dy = y2 - y1
const len = Math.sqrt(dx*dx + dy*dy)
// 基于 edge_id hash 的垂直偏移（±30px）
const offset = hashOffset(edge.edge_id, len * 0.1)
const cx = mx - (dy / len) * offset
const cy = my + (dx / len) * offset

<path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} ... />
```

### 3. 悬浮弹框：HTML Tooltip 替代 SVG Text

**当前**：SVG `<text>` 无背景、字体小、可能被遮挡

**改进**：用 React state 跟踪鼠标位置，渲染一个绝对定位的 HTML div：

```tsx
const [edgeTooltip, setEdgeTooltip] = useState<{
  x: number, y: number,
  edge: Edge, sourceName: string, targetName: string
} | null>(null)

// 在 SVG 外层包裹一个 relative div
<div className="relative">
  <svg ... />
  {edgeTooltip && (
    <div
      className="absolute z-50 px-3 py-2 rounded-lg bg-space-surface border border-space-border shadow-xl pointer-events-none"
      style={{ left: edgeTooltip.x + 12, top: edgeTooltip.y - 40 }}
    >
      <div className="text-xs text-space-muted">{sourceName} ↔ {targetName}</div>
      <div className="text-sm font-mono font-bold text-space-magenta">
        冲突分数: {edge.conflict_score.toFixed(3)}
      </div>
      <div className="text-xs text-space-muted capitalize">
        {edge.conflict_type} · {edge.debate_recommended ? '建议辩论' : '轻度分歧'}
      </div>
    </div>
  )}
</div>
```

鼠标事件用 `onMouseMove` 捕获 SVG 内的 clientX/clientY，减去 SVG 容器的 offset。

## 修改清单

1. `SpaceCanvas.tsx`
   - 新增自适应坐标映射（计算 min/max 范围）
   - 边渲染改为 `<path>` 贝塞尔曲线
   - 新增 `edgeTooltip` state 和 HTML tooltip div
   - 过滤掉 minor 冲突边（conflict_score < 0.25）

## 预期效果

| 指标 | 当前 | 改进后 |
|------|------|--------|
| 8 节点画布利用率 | ~60% | ~90% |
| 连线重叠度 | 高（直线） | 低（曲线偏移） |
| 悬浮可读性 | 12px 无背景 SVG 文字 | 有背景、阴影的 HTML div |
| 视觉噪音 | 所有边都显示 | 只显示有意义（>0.25）的边 |
