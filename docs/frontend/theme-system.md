# 主题系统

主题系统实现「一键切换全局视觉风格」，覆盖从 CSS 颜色到 3D 场景背景的完整视觉层。

## 架构设计

**核心决策**：使用 CSS 变量 + Tailwind 类覆盖，而非 CSS-in-JS 或运行时样式注入。

```
theme/
├── ThemeContext.tsx      # React Context：状态 + localStorage + data-theme
├── themes.ts             # 主题定义：元数据 + CSS 变量映射
└── ThemeSwitcher.tsx     # UI 组件：下拉选择器
```

### CSS 驱动模式

```css
/* index.css */
:root {
  --space-bg: #f0f4ff;
  --space-text: #374151;
  /* ... 默认变量 ... */
}

[data-theme="cyberpunk"] {
  --space-bg: #050508;
  --space-text: #e0e0e8;
  /* ... 覆盖变量 ... */
}

[data-theme="cyberpunk"] .bg-white {
  background-color: #0f0f1a !important;
}
[data-theme="cyberpunk"] .text-gray-700 {
  color: #b0b0c4 !important;
}
/* ... 数百条 Tailwind 类覆盖 ... */
```

**优势**：
- 零运行时开销：切换主题只需设置一个 HTML 属性
- 覆盖全面：`.bg-white`、`.text-gray-*`、`.border-indigo-*` 等所有常用类都被覆盖
- 组件无感知：业务组件不需要引入 theme 相关逻辑
- 过渡平滑：CSS `transition` 实现 0.35s 颜色渐变

---

## 主题定义 — `themes.ts`

```ts
interface ThemeMeta {
  id: ThemeId           // 'cyberpunk' | 'deepspace' | 'matrix'
  name: string          // 显示名称：霓虹迷城 / 星际认知 / 神经织网
  tagline: string       // 副标题：赛博朋克 · 霓虹数据流
  icon: string          // emoji 图标：⚡ / 🌌 / 🧠
  accent: string        // 主强调色 HEX
}
```

### 三个主题

| 主题 | ID | 名称 | 主色调 | 氛围 |
|------|-----|------|--------|------|
| 霓虹迷城 | `cyberpunk` | ⚡ 霓虹迷城 | `#00f0ff` | 深黑底 + 霓虹青/粉/紫，网格扫描线，发光边框 |
| 星际认知 | `deepspace` | 🌌 星际认知 | `#3b82f6` | 深蓝黑底 + 科技蓝/电光紫，星空粒子，渐变光晕 |
| 神经织网 | `matrix` | 🧠 神经织网 | `#00ff88` | 深绿黑底 + 矩阵绿/琥珀，数据流线条，六边形网格 |

---

## ThemeContext — 状态管理

```tsx
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<ThemeId>(() => {
    return localStorage.getItem('cognitive-theme') || 'cyberpunk'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cognitive-theme', theme)
  }, [theme])

  return <Context.Provider value={{ theme, setTheme }}>{children}</Context.Provider>
}
```

**特点**：
- 默认主题 `cyberpunk`
- localStorage 持久化
- 通过 `data-theme` 属性激活 CSS 选择器

---

## CSS 覆盖范围

### 基础变量
- `--space-bg`, `--space-surface`, `--space-border`
- `--space-text`, `--space-muted`, `--space-cyan`, `--space-magenta`
- `--space-amber`, `--space-red`, `--space-green`

### Tailwind 颜色类（3 个主题各覆盖）

**背景类**：
`.bg-white`, `.bg-gray-50/100/800/900`, `.bg-indigo-50/100/400/500`,
`.bg-blue-50`, `.bg-rose-50/100/200/400/500/600`, `.bg-amber-50/100/400/500/600`,
`.bg-green-50/100/200/600`, `.bg-pink-100`

**文字类**：
`.text-white`, `.text-gray-300~800`, `.text-indigo-400~600`, `.text-blue-400`,
`.text-rose-400~700`, `.text-amber-400~600`, `.text-green-400~700`,
`.text-pink-500/600`

**边框类**：
`.border-white/5/30/60`, `.border-indigo-50/100/200`, `.border-gray-100`,
`.border-green-100/200`, `.border-rose-100/200`, `.border-pink-100/200/300`

**透明度修饰符**：
`.bg-white/80`, `.bg-white/60`, `.text-white/90/80/60/30/10`

**伪类状态**：
`.hover:bg-white`, `.hover:bg-indigo-50/100`, `.hover:border-indigo-200`,
`.focus:border-pink-300`, `.focus:ring-pink-100`, `.focus:ring-indigo-200`,
`.group-hover:text-gray-800`, `.placeholder:text-gray-300`

### 特效类

| 类名 | Cyberpunk | DeepSpace | Matrix |
|------|-----------|-----------|--------|
| `.grid-bg` | 霓虹网格 48px | 星空粒子点 32px | 矩阵网格 40px |
| `.glow-cyan` | 青色光晕 | 蓝色光晕 | 绿色光晕 |
| `.glow-magenta` | 粉色光晕 | 紫色光晕 | 琥珀光晕 |
| `.text-glow` | 青色文字发光 | 蓝色文字发光 | 绿色文字发光 |

### Markdown 样式
- `code` 背景色与文字色
- `pre` 背景色
- `blockquote` 左边框色
- `a` 链接色
- `th` 表头背景色

### 滚动条
- 轨道背景色
- 滑块颜色与悬停色

### 主题切换器样式
- 触发按钮背景/边框/文字色
- 下拉面板背景/边框
- 选项悬停/激活态

---

## 3D 场景主题适配

CSS 无法影响 WebGL 渲染，因此 3D 场景通过 JS 直接读取主题：

```ts
// UniverseScene.tsx
const bgColor = appTheme === 'cyberpunk' ? '#050508'
              : appTheme === 'deepspace' ? '#0a0f1e'
              : '#060f0a'
gl.setClearColor(bgColor)
```

- **Canvas 背景色**：随主题变化
- **CenterNode 颜色**：主题 accent 色
- **AgentTooltip  stance 色**：主题化

---

## 平滑过渡

```css
html, html *, html *::before, html *::after {
  transition: background-color 0.35s ease,
              border-color 0.35s ease,
              color 0.25s ease,
              box-shadow 0.35s ease;
}
```

**排除元素**：
```css
canvas, .mesh, .mesh * {
  transition: none !important;
}
```

WebGL 渲染不需要 CSS 过渡，避免性能损耗。
