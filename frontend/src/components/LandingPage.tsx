import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, ArrowRight, Briefcase, Code, Heart } from 'lucide-react'
import { api } from '../api'
import { useSpaceState } from '../store/SpaceContext'
import LoadingBunny from './LoadingBunny'
import type { HotQuestionPreset } from '../api-types'

const ICON_MAP: Record<string, React.ElementType> = {
  briefcase: Briefcase,
  code: Code,
  heart: Heart,
}

export default function LandingPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [hotQuestions, setHotQuestions] = useState<HotQuestionPreset[]>([])
  const navigate = useNavigate()
  const { dispatch } = useSpaceState()

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
      const space = await api.createSpace({ query, user_context: {} })
      const elapsed = Date.now() - startTime
      const minDelay = 2200
      if (elapsed < minDelay) {
        await new Promise((r) => setTimeout(r, minDelay - elapsed))
      }
      dispatch({ type: 'SET_SPACE', payload: space })
      navigate(`/space/${space.space_id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingBunny query={query} />
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* 顶部徽章 */}
      <div className="mb-6 px-4 py-1.5 rounded-full bg-white border border-indigo-100 shadow-sm">
        <span className="text-xs font-bold text-indigo-400">
          🚀 知乎黑客松 Demo — 决策罗盘
        </span>
      </div>

      {/* 主标题区域 */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white border-2 border-indigo-100 shadow-lg mb-6">
          <Compass className="w-10 h-10 text-indigo-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-3 text-space-text tracking-tight">
          🧭 决策罗盘
        </h1>
        <p className="text-space-muted text-lg max-w-lg mx-auto leading-relaxed">
          遇到重大选择犹豫不决？<br />
          <span className="text-indigo-500 font-bold">召唤不同视角的角色</span>，
          帮你看到分歧、理清思路
        </p>
      </div>

      {/* 输入框 */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl relative mb-8">
        <div className="relative bg-white border-2 border-indigo-100 rounded-3xl p-2 shadow-lg">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入你的困惑，比如：我该辞职创业吗？"
            className="w-full bg-transparent px-6 py-4 text-lg outline-none placeholder:text-gray-300"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-6 py-2.5 bg-indigo-400 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md transition-all"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="font-bold">开始探索</span>
          </button>
        </div>
      </form>

      {/* 热门问题卡片 */}
      <div className="w-full max-w-3xl">
        <p className="text-center text-sm text-gray-400 mb-4 font-medium">
          💡 大家都在纠结这些
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hotQuestions.map((q) => {
            const Icon = ICON_MAP[q.icon_type] || Compass
            return (
              <button
                key={q.text}
                onClick={() => setQuery(q.text)}
                className="group text-left p-5 rounded-2xl bg-white border-2 border-indigo-50 hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${q.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: q.color }} />
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${q.color}15`, color: q.color }}
                  >
                    {q.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 font-medium group-hover:text-gray-800 transition-colors">
                  {q.text}
                </p>
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
  )
}
