import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import SpaceScene from './SpaceScene'
import DebatePanel from './DebatePanel'
import MetricsHUD from './MetricsHUD'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SpacePage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const { state, dispatch } = useSpaceState()
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)

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

  if (state.loading && !state.space) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-space-cyan animate-spin" />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-space-red mb-4">{state.error}</p>
        <Link to="/" className="text-space-cyan hover:underline">
          ← 返回首页
        </Link>
      </div>
    )
  }

  if (!state.space) return null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-space-border bg-space-surface/50 backdrop-blur">
        <Link to="/" className="text-space-muted hover:text-space-text transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-lg font-medium truncate max-w-xl">
          {state.space.query}
        </h2>
      </header>

      <MetricsHUD />

      <main className="flex-1 relative">
        <SpaceScene
          onEdgeClick={(edgeId) => setSelectedEdge(edgeId)}
        />

        {selectedEdge && (
          <DebatePanel
            edgeId={selectedEdge}
            onClose={() => setSelectedEdge(null)}
          />
        )}
      </main>
    </div>
  )
}
