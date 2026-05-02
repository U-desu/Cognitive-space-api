import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, ArrowRight, Sparkles } from 'lucide-react'
import { api } from '../api'
import { useSpaceState } from '../store/SpaceContext'

export default function LandingPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { dispatch } = useSpaceState()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const space = await api.createSpace({ query, user_context: {} })
      dispatch({ type: 'SET_SPACE', payload: space })
      navigate(`/space/${space.space_id}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-space-surface border border-space-border glow-cyan mb-6">
          <Brain className="w-10 h-10 text-space-cyan" />
        </div>
        <h1 className="text-5xl font-bold mb-4 text-glow">
          认知空间
        </h1>
        <p className="text-space-muted text-lg max-w-md mx-auto">
          输入一个问题，探索多视角认知冲突，构建你的认知拓扑
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl relative"
      >
        <div className="relative bg-space-surface border border-space-border rounded-2xl p-2 glow-cyan">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：我是否应该从大厂离职去做AI创业？"
            className="w-full bg-transparent px-6 py-4 text-lg outline-none placeholder:text-space-muted/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-6 py-2.5 bg-space-cyan/10 hover:bg-space-cyan/20 text-space-cyan rounded-xl border border-space-cyan/30 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Sparkles className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            <span className="font-medium">
              {loading ? '生成中...' : '探索'}
            </span>
          </button>
        </div>
      </form>

      <div className="mt-8 flex gap-3">
        {['职业决策', '投资决策', '技术选型'].map((tag) => (
          <button
            key={tag}
            onClick={() => setQuery(`关于${tag}的问题`)}
            className="px-4 py-1.5 rounded-full text-sm bg-space-surface border border-space-border text-space-muted hover:text-space-text hover:border-space-cyan/30 transition-all"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  )
}
