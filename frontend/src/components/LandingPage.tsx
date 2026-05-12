import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, ArrowRight, Briefcase, Code, Heart } from 'lucide-react'
import { api } from '../api'
import { useSpaceState } from '../store/SpaceContext'
// import { useAuth } from '../auth/useAuth'
import { useTheme } from '../theme/ThemeContext'
// import ThemeSwitcher from '../theme/ThemeSwitcher'
import LoadingBunny from './LoadingBunny'
import SpaceHistorySidebar from './SpaceHistorySidebar'
import DedupModal from './DedupModal'
import Logo from './Logo'
import type { HotQuestionPreset, Space } from '../api-types'

const ICON_MAP: Record<string, React.ElementType> = {
  briefcase: Briefcase,
  code: Code,
  heart: Heart,
}

/** 主题感知的背景装饰光晕 */
function ThemeGlow() {
  const { theme } = useTheme()

  const glows = {
    cyberpunk: [
      { color: '#00f0ff', x: '15%', y: '20%', size: 300, blur: 120 },
      { color: '#ff00a0', x: '80%', y: '30%', size: 250, blur: 100 },
      { color: '#b026ff', x: '50%', y: '80%', size: 350, blur: 140 },
    ],
    deepspace: [
      { color: '#3b82f6', x: '20%', y: '25%', size: 320, blur: 130 },
      { color: '#8b5cf6', x: '75%', y: '20%', size: 280, blur: 110 },
      { color: '#06b6d4', x: '45%', y: '75%', size: 300, blur: 120 },
    ],
    matrix: [
      { color: '#00ff88', x: '18%', y: '22%', size: 280, blur: 110 },
      { color: '#00d4aa', x: '78%', y: '28%', size: 260, blur: 100 },
      { color: '#f59e0b', x: '50%', y: '78%', size: 340, blur: 130 },
    ],
    zhihu: [
      { color: '#0084ff', x: '15%', y: '20%', size: 300, blur: 120 },
      { color: '#00b4ff', x: '80%', y: '30%', size: 250, blur: 100 },
      { color: '#0066ff', x: '50%', y: '80%', size: 350, blur: 140 },
    ],
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {glows[theme].map((g, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-[0.12]"
          style={{
            left: g.x,
            top: g.y,
            width: g.size,
            height: g.size,
            transform: 'translate(-50%, -50%)',
            background: g.color,
            filter: `blur(${g.blur}px)`,
          }}
        />
      ))}
    </div>
  )
}

export default function LandingPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [hotQuestions, setHotQuestions] = useState<HotQuestionPreset[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showDedup, setShowDedup] = useState(false)
  const [dedupSpace, setDedupSpace] = useState<Space | null>(null)
  const [dedupSimilarity, setDedupSimilarity] = useState(0)
  const navigate = useNavigate()
  const { dispatch } = useSpaceState()
  // const { user, logout } = useAuth()
  const { theme } = useTheme()

  useEffect(() => {
    api.getHotQuestions()
      .then(setHotQuestions)
      .catch(() => setHotQuestions([]))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const startTime = Date.now()
      const { space, reused, similarity } = await api.createSpace({ query, user_context: {} })
      const elapsed = Date.now() - startTime
      const minDelay = 2200
      if (elapsed < minDelay) {
        await new Promise((r) => setTimeout(r, minDelay - elapsed))
      }
      if (reused) {
        setDedupSpace(space)
        setDedupSimilarity(similarity)
        setShowDedup(true)
        setLoading(false)
        return
      }
      dispatch({ type: 'SET_SPACE', payload: space })
      navigate(`/space/${space.space_id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
      setLoading(false)
    }
  }

  const handleReuse = () => {
    if (!dedupSpace || loading) return
    setShowDedup(false)
    setLoading(true)
    dispatch({ type: 'SET_SPACE', payload: dedupSpace })
    // 延迟 60ms 确保 LoadingBunny 渲染后再导航，阻止重复点击
    setTimeout(() => {
      navigate(`/space/${dedupSpace.space_id}`)
    }, 60)
  }

  const handleCreateNew = () => {
    if (loading) return
    setShowDedup(false)
    // 当前 API 没有强制跳过去重参数，直接复用已有空间
    handleReuse()
  }

  if (loading) {
    return <LoadingBunny query={query} />
  }

  const sidebarOffset = sidebarOpen ? 280 : 56

  // 主题特定的装饰线颜色
  const accentColors = {
    cyberpunk: '#00f0ff',
    deepspace: '#3b82f6',
    matrix: '#00ff88',
    zhihu: '#0084ff',
  }
  const accent = accentColors[theme]

  return (
    <div className="min-h-screen relative">
      <ThemeGlow />

      <SpaceHistorySidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <DedupModal
        isOpen={showDedup}
        existingSpace={dedupSpace}
        similarity={dedupSimilarity}
        onReuse={handleReuse}
        onCreateNew={handleCreateNew}
        onClose={() => setShowDedup(false)}
      />

      {/* 顶部导航栏已隐藏 */}
      {/*
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-end px-6 py-3">
        <div className="flex items-center gap-3">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full border-2" style={{ borderColor: accent + '50' }} />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}88)` }}
            >
              {user?.username[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-sm text-white/90 hidden sm:inline">{user?.username}</span>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-full border border-white/30 text-white/80 hover:bg-white/10 transition"
          >
            退出
          </button>
        </div>
      </header>
      */}

      <div
        className="relative flex flex-col items-center justify-center min-h-screen px-4 pt-14 transition-all duration-300"
        style={{ paddingLeft: sidebarOffset }}
      >
        {/* 主标题区域 */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl border-2 shadow-lg mb-6 glow-cyan"
            style={{ backgroundColor: accent + '10', borderColor: accent + '30' }}
          >
            <Logo size={40} />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 text-space-text tracking-tight text-glow">
            知乎 X SPACE
          </h1>
        </div>

        {/* 输入框 */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl relative mb-8">
          <div
            className="relative border-2 rounded-3xl p-2 shadow-lg transition-all hover:shadow-xl"
            style={{ backgroundColor: 'var(--space-surface)', borderColor: accent + '30' }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入你的困惑，比如：我该辞职创业吗？"
              className="w-full bg-transparent px-6 py-4 text-lg outline-none placeholder:text-gray-300 text-space-text"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-bold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
            >
              <ArrowRight className="w-4 h-4" />
              <span className="font-bold">开始探索</span>
            </button>
          </div>
        </form>

        {/* 热门问题卡片 */}
        <div className="w-full max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {hotQuestions.map((q) => {
              const Icon = ICON_MAP[q.icon_type] || Compass
              return (
                <button
                  key={q.text}
                  onClick={() => setQuery(q.text)}
                  className="group text-left p-3 rounded-xl border transition-all hover:shadow-md relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--space-surface)',
                    borderColor: accent + '15',
                  }}
                >
                  <p className="text-sm text-space-text font-medium leading-snug mb-2 line-clamp-2">
                    {q.text}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3 h-3 shrink-0" style={{ color: q.color }} />
                    <span className="text-[10px] font-bold" style={{ color: q.color }}>
                      {q.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 底部说明 */}
        <div className="mt-10 text-center">
          <p className="text-xs text-gray-400 max-w-md leading-relaxed">
            基于知乎海量观点构建 · 多 Agent 结构化辩论 · 不给你标准答案，只帮你看到分歧
          </p>
        </div>
      </div>
    </div>
  )
}
