import { useEffect, useState, useCallback } from 'react'
import { X, MessageSquare, Lightbulb, CheckCircle2 } from 'lucide-react'
import { useSpaceState } from '../store/SpaceContext'
import { useDebateStream } from '../hooks/useDebateStream'
import StreamTurnCard from './StreamTurnCard'

interface Props {
  edgeId: string
  onClose: () => void
}

export default function DebatePanel({ edgeId, onClose }: Props) {
  const { state: spaceState, dispatch } = useSpaceState()
  const { state: streamState, start, stop } = useDebateStream()

  // Track which turns have finished typing
  const [typedTurns, setTypedTurns] = useState<Set<number>>(new Set())

  const agentMap = new Map(spaceState.space?.agents.map((a) => [a.agent_id, a]))

  // Start SSE stream when panel opens
  useEffect(() => {
    if (!spaceState.space || !edgeId) return
    start(spaceState.space.space_id, edgeId, 2)
    return () => stop()
  }, [edgeId, spaceState.space, start, stop])

  // Mark turns as typed once stream moves to the next one
  useEffect(() => {
    const turns = streamState.turns
    if (turns.length === 0) return
    // All previous turns are done typing
    const newTyped = new Set(typedTurns)
    for (let i = 0; i < turns.length - 1; i++) {
      newTyped.add(i)
    }
    // Latest turn: auto-mark as typed after a generous delay
    const latestIdx = turns.length - 1
    if (!newTyped.has(latestIdx)) {
      const delay = Math.min(turns[latestIdx].content.length * 30 + 1000, 8000)
      const timer = setTimeout(() => {
        setTypedTurns((prev) => new Set(prev).add(latestIdx))
      }, delay)
      return () => clearTimeout(timer)
    }
    setTypedTurns(newTyped)
  }, [streamState.turns, typedTurns])

  // On stream complete, save debate to global state
  useEffect(() => {
    if (!streamState.done) return
    const d = streamState.done
    dispatch({
      type: 'SET_DEBATE',
      payload: {
        debate_id: d.debate_id,
        edge_id: d.edge_id,
        participants: d.participants,
        transcript: d.transcript,
        synthesis: d.synthesis,
        visualization: {},
      },
    })
  }, [streamState.done, dispatch])

  // Determine if a turn is the first of its round
  const isFirstOfRound = useCallback((turns: typeof streamState.turns, idx: number) => {
    if (idx === 0) return true
    return turns[idx].round !== turns[idx - 1].round
  }, [])

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white border-l border-space-border shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-space-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-space-cyan" />
          <h3 className="text-lg font-extrabold">💬 角色对话</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          <X className="w-5 h-5 text-space-muted" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Loading / Waiting for first turn */}
        {streamState.loading && streamState.turns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-8 h-8 border-2 border-space-cyan border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-space-muted animate-pulse">
              正在召唤辩论专家…
            </p>
          </div>
        )}

        {/* Turns */}
        {streamState.turns.map((turn, idx) => {
          const isLatest = idx === streamState.turns.length - 1
          const isTypingThis = isLatest && !typedTurns.has(idx)

          return (
            <div key={`${turn.round}-${turn.agent}-${idx}`} className="space-y-4">
              {isFirstOfRound(streamState.turns, idx) && (
                <div className="text-xs font-mono text-space-muted uppercase tracking-wider">
                  Round {turn.round}
                </div>
              )}
              <StreamTurnCard
                turn={turn}
                agent={agentMap.get(turn.agent)}
                isTyping={isTypingThis}
              />
            </div>
          )
        })}

        {/* Synthesis */}
        {streamState.synthesis && (
          <div className="pt-4 border-t border-space-border space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-space-amber" />
              <span className="text-sm font-extrabold text-space-amber">
                💡 总结
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-space-bg border border-space-border">
              <div className="text-xs text-space-muted mb-1 font-bold">核心冲突</div>
              <div className="text-sm text-space-text mb-3">
                {streamState.synthesis.core_conflict}
              </div>

              <div className="text-xs text-space-muted mb-1 font-bold">建议</div>
              <div className="text-sm text-space-cyan font-bold mb-3">
                {streamState.synthesis.resolution_suggestion}
              </div>

              {streamState.synthesis.agreement_points.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-space-muted mb-1">共识</div>
                  <div className="flex flex-wrap gap-2">
                    {streamState.synthesis.agreement_points.map((pt, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-600 border border-blue-200 font-bold"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {pt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {streamState.synthesis.divergence_points.length > 0 && (
                <div>
                  <div className="text-xs text-space-muted mb-1">分歧</div>
                  <div className="flex flex-wrap gap-2">
                    {streamState.synthesis.divergence_points.map((pt, i) => (
                      <span
                        key={i}
                        className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-600 border border-purple-200 font-bold"
                      >
                        {pt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {streamState.error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {streamState.error}
          </div>
        )}
      </div>
    </div>
  )
}
