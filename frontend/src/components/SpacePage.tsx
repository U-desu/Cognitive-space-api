import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import SpaceScene from './SpaceScene'
import AgentPanel from './AgentPanel'
import MetricsHUD from './MetricsHUD'
import ShareCard from './ShareCard'
import { ArrowLeft, Loader2, Share2, RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const { state, dispatch } = useSpaceState()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'global' | 'focus'>('global')
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    if (!spaceId) return
    let cancelled = false

    async function load() {
      dispatch({ type: 'SET_LOADING', payload: true })
      try {
        const space = await api.getSpace(spaceId!)
        if (cancelled) return
        dispatch({ type: 'SET_SPACE', payload: space })

        const edgesRes = await api.computeEdges(spaceId!)
        if (cancelled) return
        dispatch({ type: 'SET_EDGES', payload: edgesRes.edges })

        const traj = await api.getTrajectory(spaceId!)
        if (cancelled) return
        dispatch({ type: 'SET_TRAJECTORY', payload: traj })
      } catch (err) {
        if (!cancelled) {
          dispatch({ type: 'SET_ERROR', payload: String(err) })
        }
      } finally {
        if (!cancelled) dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    load()
    return () => { cancelled = true }
  }, [spaceId, dispatch])

  const handleAgentClick = (agentId: string) => {
    setSelectedAgent(agentId)
    setViewMode('focus')
  }

  const handleBackToGlobal = () => {
    setSelectedAgent(null)
    setViewMode('global')
  }

  if (state.loading && !state.space) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-rose-500 mb-4 font-bold">{state.error}</p>
        <Link to="/" className="text-indigo-400 hover:underline font-bold">
          ← 返回首页
        </Link>
      </div>
    )
  }

  if (!state.space) return null

  const isFocus = viewMode === 'focus'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-indigo-100 bg-white/80 backdrop-blur z-40">
        {isFocus ? (
          <button
            onClick={handleBackToGlobal}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-500 transition-colors"
            title="返回全局视图"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}

        <h2 className="text-base font-bold text-gray-700 truncate max-w-xl flex-1">
          {isFocus && selectedAgent
            ? (() => {
                const agent = state.space?.agents.find((a) => a.agent_id === selectedAgent)
                return agent ? `🔍 聚焦：${agent.name}` : state.space.query
              })()
            : state.space.query}
        </h2>

        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-500 text-xs font-bold transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          分享
        </button>
      </header>

      <MetricsHUD />

      <main className="relative flex-1" style={{ height: 'calc(100vh - 120px)' }}>
        <SpaceScene
          onAgentClick={handleAgentClick}
          selectedAgent={selectedAgent}
          viewMode={viewMode}
        />

        {selectedAgent && isFocus && (
          <AgentPanel
            agentId={selectedAgent}
            onClose={handleBackToGlobal}
          />
        )}

        {showShare && spaceId && (
          <ShareCard
            spaceId={spaceId}
            onClose={() => setShowShare(false)}
          />
        )}
      </main>
    </div>
  )
}
