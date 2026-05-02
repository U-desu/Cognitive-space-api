import { useEffect, useState } from 'react'
import { X, MessageSquare, Lightbulb, CheckCircle2 } from 'lucide-react'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import type { Debate } from '../api-types'

interface Props {
  edgeId: string
  onClose: () => void
}

export default function DebatePanel({ edgeId, onClose }: Props) {
  const { state, dispatch } = useSpaceState()
  const [debate, setDebate] = useState<Debate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!state.space || !edgeId) return
    setLoading(true)
    api
      .createDebate(state.space.space_id, {
        edge_id: edgeId,
        format: 'structured',
        rounds: 2,
      })
      .then((d) => {
        setDebate(d)
        dispatch({ type: 'SET_DEBATE', payload: d })
      })
      .catch(() => {
        // Mock fallback: create a minimal debate from edge
        const edge = state.edges.find((e) => e.edge_id === edgeId)
        if (edge) {
          const mockDebate: Debate = {
            debate_id: 'mock_debate',
            edge_id: edgeId,
            participants: [edge.source, edge.target],
            transcript: [
              {
                round: 1,
                turns: [
                  {
                    agent: edge.source,
                    type: 'argument',
                    content: '我方认为当前是最佳时机...',
                    evidence: [],
                  },
                  {
                    agent: edge.target,
                    type: 'rebuttal',
                    content: '但风险过高，应谨慎行事...',
                    evidence: [],
                  },
                ],
              },
            ],
            synthesis: {
              core_conflict: '风险判断的时间尺度不同',
              resolution_suggestion: '先用副业验证PMF',
              agreement_points: ['AI是长期趋势'],
              divergence_points: ['最佳入场时机', '可接受的风险水平'],
            },
            visualization: {},
          }
          setDebate(mockDebate)
          dispatch({ type: 'SET_DEBATE', payload: mockDebate })
        }
      })
      .finally(() => setLoading(false))
  }, [edgeId, state.space, state.edges, dispatch])

  const agentMap = new Map(state.space?.agents.map((a) => [a.agent_id, a]))

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-space-surface border-l border-space-border shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-space-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-space-cyan" />
          <h3 className="text-lg font-semibold">结构化辩论</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-space-border transition-colors"
        >
          <X className="w-5 h-5 text-space-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-space-cyan border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {debate?.transcript.map((round: { round: number; turns: { agent: string; type: string; content: string; evidence: string[] }[] }) => (
          <div key={round.round} className="space-y-4">
            <div className="text-xs font-mono text-space-muted uppercase tracking-wider">
              Round {round.round}
            </div>
            {round.turns.map((turn: { agent: string; type: string; content: string; evidence: string[] }, idx: number) => {
              const agent = agentMap.get(turn.agent)
              const isPro = agent?.stance === 'pro'
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border ${
                    isPro
                      ? 'border-space-cyan/20 bg-space-cyan/5'
                      : 'border-space-red/20 bg-space-red/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded ${
                        isPro ? 'bg-space-cyan/20 text-space-cyan' : 'bg-space-red/20 text-space-red'
                      }`}
                    >
                      {agent?.name ?? turn.agent}
                    </span>
                    <span className="text-xs text-space-muted capitalize">
                      {turn.type}
                    </span>
                  </div>
                  <p className="text-sm text-space-text leading-relaxed">
                    {turn.content}
                  </p>
                </div>
              )
            })}
          </div>
        ))}

        {debate?.synthesis && (
          <div className="pt-4 border-t border-space-border space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-space-amber" />
              <span className="text-sm font-semibold text-space-amber">
                认知合成
              </span>
            </div>

            <div className="p-4 rounded-xl bg-space-bg border border-space-border">
              <div className="text-xs text-space-muted mb-1">核心冲突</div>
              <div className="text-sm text-space-text mb-3">
                {debate.synthesis.core_conflict}
              </div>

              <div className="text-xs text-space-muted mb-1">建议</div>
              <div className="text-sm text-space-cyan mb-3">
                {debate.synthesis.resolution_suggestion}
              </div>

              {debate.synthesis.agreement_points.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-space-muted mb-1">共识</div>
                  <div className="flex flex-wrap gap-2">
                    {debate.synthesis.agreement_points.map((pt: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-space-cyan/10 text-space-cyan border border-space-cyan/20"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {pt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {debate.synthesis.divergence_points.length > 0 && (
                <div>
                  <div className="text-xs text-space-muted mb-1">分歧</div>
                  <div className="flex flex-wrap gap-2">
                    {debate.synthesis.divergence_points.map((pt: string, i: number) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded-full bg-space-magenta/10 text-space-magenta border border-space-magenta/20"
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
      </div>
    </div>
  )
}
