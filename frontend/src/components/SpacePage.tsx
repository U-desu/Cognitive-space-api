import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import UniverseScene from '../scene/UniverseScene'
import AgentPanel from './AgentPanel'
import MetricsHUD from './MetricsHUD'
import ShareCard from './ShareCard'
import ThemeSwitcher from '../theme/ThemeSwitcher'
import { Loader2, Share2 } from 'lucide-react'
import Logo from './Logo'

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const { state, dispatch } = useSpaceState()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'global' | 'focus'>('global')
  const [agentClickCount, setAgentClickCount] = useState(0)
  const [showShare, setShowShare] = useState(false)
  const [resetCameraSignal, setResetCameraSignal] = useState(0)
  const [expandingAgentId, setExpandingAgentId] = useState<string | null>(null)
  const [debatingAgentIds, setDebatingAgentIds] = useState<string[]>([])
  const [isPanelBusy, setIsPanelBusy] = useState(false)

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
    if (isPanelBusy) return
    setSelectedAgent(agentId)
    setViewMode('focus')
    if (viewMode === 'focus') {
      setAgentClickCount((c) => c + 1)
    }
  }

  const handleExpandAgent = (agentId: string) => {
    if (isPanelBusy) return
    setSelectedAgent(agentId)
    setViewMode('focus')
    setAgentClickCount((c) => c + 1)
  }

  const handleBackToGlobal = () => {
    if (isPanelBusy) return
    setSelectedAgent(null)
    setViewMode('global')
  }

  const handleResetCamera = () => {
    setResetCameraSignal((c) => c + 1)
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
      </div>
    )
  }

  if (!state.space) return null

  const isFocus = viewMode === 'focus'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 pl-3 pr-6 pt-6 pb-3 border-b border-indigo-100 bg-white/80 backdrop-blur z-40">
        <div
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0"
          title="返回上级"
        >
          <Logo size={24} />
        </div>
        <div className="flex items-center flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-700 truncate">
            {state.space.query}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-500 text-xs font-bold transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            分享
          </button>
        </div>
      </header>

      <MetricsHUD />

      <main className="relative flex-1" style={{ height: 'calc(100vh - 120px)' }}>
        <UniverseScene
          onAgentClick={handleAgentClick}
          selectedAgent={selectedAgent}
          viewMode={viewMode}
          onBackToGlobal={handleBackToGlobal}
          onExpandAgent={handleExpandAgent}
          resetCameraSignal={resetCameraSignal}
          onResetCamera={handleResetCamera}
          debatingAgentIds={debatingAgentIds}
          expandingAgentId={expandingAgentId}
          isBusy={isPanelBusy}
        />

        {selectedAgent && isFocus && (
          <AgentPanel
            key={agentClickCount}
            agentId={selectedAgent}
            onClose={handleBackToGlobal}
            onDebatingChange={(ids) => setDebatingAgentIds(ids ?? [])}
            onExpandingChange={(id) => {
              setExpandingAgentId(id)
              if (id) {
                setTimeout(() => setExpandingAgentId((current) => current === id ? null : current), 3000)
              }
            }}
            onBusyChange={setIsPanelBusy}
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
