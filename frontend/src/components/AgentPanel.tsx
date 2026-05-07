import { useState, useMemo, useEffect } from 'react'
import { X, MessageSquare, Swords, Target, Lightbulb, CheckCircle2, User } from 'lucide-react'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import type { Edge, Agent, Debate } from '../api-types'

interface Props {
  agentId: string | null
  onClose: () => void
}

const STANCE_EMOJI: Record<string, string> = {
  pro: '✅',
  con: '❌',
  neutral: '⚖️',
}

const STANCE_LABEL: Record<string, string> = {
  pro: '支持派',
  con: '反对派',
  neutral: '中立派',
}

const STANCE_BG: Record<string, string> = {
  pro: '#dcfce7',
  con: '#ffe4e6',
  neutral: '#fef3c7',
}

const STANCE_TEXT: Record<string, string> = {
  pro: '#166534',
  con: '#9f1239',
  neutral: '#92400e',
}

export default function AgentPanel({ agentId, onClose }: Props) {
  const { state } = useSpaceState()
  const [debate, setDebate] = useState<Debate | null>(null)
  const [debateLoading, setDebateLoading] = useState(false)

  const space = state.space
  const edges = state.edges
  const agents = space?.agents ?? []

  const agent = useMemo(() => {
    return agents.find((a) => a.agent_id === agentId) ?? null
  }, [agents, agentId])

  // Clear debate when switching agents
  useEffect(() => {
    setDebate(null)
    setDebateLoading(false)
  }, [agentId])

  // Find edges related to this agent, sorted by conflict score
  const relatedEdges = useMemo(() => {
    if (!agentId) return []
    const list = edges.filter(
      (e) => e.source === agentId || e.target === agentId
    )
    list.sort((a, b) => b.conflict_score - a.conflict_score)
    return list
  }, [edges, agentId])

  function getOpponent(edge: Edge): Agent | null {
    const id = edge.source === agentId ? edge.target : edge.source
    return agents.find((a) => a.agent_id === id) ?? null
  }

  async function handleDebate(edge: Edge) {
    if (!space) return
    setDebateLoading(true)
    try {
      const d = await api.createDebate(space.space_id, {
        edge_id: edge.edge_id,
        format: 'structured',
        rounds: 2,
      })
      setDebate(d)
    } catch {
      // Mock fallback: build a minimal debate
      const mockDebate: Debate = {
        debate_id: 'mock_debate',
        edge_id: edge.edge_id,
        participants: [edge.source, edge.target],
        transcript: [
          {
            round: 1,
            turns: [
              {
                agent: edge.source,
                type: 'argument',
                content: '我方认为当前是最佳时机，窗口期有限，应该果断行动。',
                evidence: [],
              },
              {
                agent: edge.target,
                type: 'rebuttal',
                content: '但风险过高，盲目入场失败率极高，应谨慎行事。',
                evidence: [],
              },
            ],
          },
        ],
        synthesis: {
          core_conflict: '风险判断的时间尺度不同',
          resolution_suggestion: '先用副业验证PMF，降低试错成本',
          agreement_points: ['趋势是不可逆的', '需要准备而非冲动'],
          divergence_points: ['最佳入场时机', '可接受的风险水平'],
        },
        visualization: {},
      }
      setDebate(mockDebate)
    } finally {
      setDebateLoading(false)
    }
  }

  if (!agentId || !agent) return null

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-indigo-100 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-50">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-gray-700">角色详情</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Agent Profile Card */}
        <div className="p-5 border-b border-indigo-50">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl shrink-0">
              {agent.stance === 'pro' ? '✅' : agent.stance === 'con' ? '❌' : '⚖️'}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">{agent.name}</h2>
              <span
                className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mt-1"
                style={{
                  backgroundColor: STANCE_BG[agent.stance] || '#f3f4f6',
                  color: STANCE_TEXT[agent.stance] || '#374151',
                }}
              >
                {STANCE_EMOJI[agent.stance]} {STANCE_LABEL[agent.stance]}
              </span>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs text-gray-400 font-bold mb-1">人设</p>
            <p className="text-sm text-gray-600 leading-relaxed">{agent.persona}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 font-bold mb-1">核心观点</p>
            <p className="text-sm text-gray-700 leading-relaxed font-medium bg-indigo-50 rounded-xl p-3">
              {agent.summary}
            </p>
          </div>
        </div>

        {/* Conflict Ranking */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Swords className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-extrabold text-gray-700">冲突排行榜</h3>
            <span className="text-xs text-gray-400 ml-auto">
              与该角色分歧最大的对手
            </span>
          </div>

          {relatedEdges.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              暂无冲突数据
            </p>
          )}

          <div className="space-y-3">
            {relatedEdges.map((edge) => {
              const opponent = getOpponent(edge)
              if (!opponent) return null
              return (
                <div
                  key={edge.edge_id}
                  className="p-4 rounded-2xl border border-indigo-50 bg-gray-50/50 hover:bg-white hover:shadow-sm hover:border-indigo-100 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {opponent.stance === 'pro' ? '✅' : opponent.stance === 'con' ? '❌' : '⚖️'}
                      </span>
                      <span className="text-sm font-bold text-gray-700">
                        {opponent.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        edge.conflict_type === 'fundamental'
                          ? 'bg-rose-100 text-rose-600'
                          : edge.conflict_type === 'partial'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      冲突 {(edge.conflict_score * 100).toFixed(0)}%
                    </span>
                  </div>

                  {edge.divergence_axes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {edge.divergence_axes.map((axis, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-bold"
                        >
                          {axis.axis}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleDebate(edge)}
                    disabled={debateLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-400 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {debateLoading ? '生成中...' : '观看他们辩论'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Debate Result */}
        {debate && (
          <div className="p-5 border-t border-indigo-50 bg-indigo-50/30">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-extrabold text-gray-700">💬 结构化辩论</h3>
            </div>

            {debate.transcript.map((round) => (
              <div key={round.round} className="space-y-3 mb-4">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Round {round.round}
                </div>
                {round.turns.map((turn, idx) => {
                  const speaker = agents.find((a) => a.agent_id === turn.agent)
                  const isPro = speaker?.stance === 'pro'
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border-2 ${
                        isPro
                          ? 'border-green-100 bg-green-50'
                          : 'border-rose-100 bg-rose-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPro
                              ? 'bg-green-200 text-green-700'
                              : 'bg-rose-200 text-rose-700'
                          }`}
                        >
                          {speaker?.name ?? turn.agent}
                        </span>
                        <span className="text-[10px] text-gray-400 capitalize">
                          {turn.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {turn.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            ))}

            {debate.synthesis && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-extrabold text-gray-700">核心冲突</span>
                </div>
                <p className="text-xs text-gray-700 bg-white rounded-xl p-3 border border-indigo-50">
                  {debate.synthesis.core_conflict}
                </p>

                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-extrabold text-gray-700">给你的建议</span>
                </div>
                <p className="text-xs text-indigo-600 font-bold bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                  {debate.synthesis.resolution_suggestion}
                </p>

                {debate.synthesis.agreement_points.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 mb-1.5">双方共识</div>
                    <div className="flex flex-wrap gap-1.5">
                      {debate.synthesis.agreement_points.map((pt, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-green-100 text-green-600 border border-green-200 font-bold"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {pt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
