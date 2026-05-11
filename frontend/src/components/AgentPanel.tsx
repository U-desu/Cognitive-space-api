import { useState, useEffect, useMemo, useRef } from 'react'
import {
  X,
  ArrowLeft,
  MessageSquare,
  Swords,
  Target,
  Lightbulb,
  CheckCircle2,
  User,
  Users,
  ExternalLink,
  Loader2,
  GitBranch,
} from 'lucide-react'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import type { AgentExpandPayload } from '../api-types'
import { useDebateStream } from '../hooks/useDebateStream'
import { useTheme } from '../theme/ThemeContext'
import { THEMES } from '../theme/themes'
import StreamTurnCard from './StreamTurnCard'
import type { Edge, Agent, ExternalUser, ExternalQuestion, Debate } from '../api-types'
import { getDepth } from '../utils/agent-hierarchy'

type PanelPage = 'profile' | 'debate' | 'cluster'

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

function getStanceColors(theme: string) {
  const accent = theme === 'cyberpunk' ? '#00f0ff' : theme === 'deepspace' ? '#3b82f6' : '#00ff88'
  return {
    pro: { bg: accent + '18', text: accent },
    con: { bg: '#ff444418', text: '#ff4444' },
    neutral: { bg: '#f59e0b18', text: '#f59e0b' },
  }
}

interface Props {
  agentId: string | null
  onClose: () => void
  onDebatingChange?: (agentIds: string[] | null) => void
  onExpandingChange?: (agentId: string | null) => void
  onBusyChange?: (busy: boolean, type?: 'debate' | 'expand') => void
  onShowBusyToast?: () => void
}

export default function AgentPanel({ agentId, onClose, onDebatingChange, onExpandingChange, onBusyChange, onShowBusyToast }: Props) {
  const { state, dispatch } = useSpaceState()
  const { theme } = useTheme()
  const stanceColors = getStanceColors(theme)
  const [page, setPage] = useState<PanelPage>('profile')
  const [expandLoading, setExpandLoading] = useState(false)
  const [expandHint, setExpandHint] = useState('')
  const [selectedEdgeForDebate, setSelectedEdgeForDebate] = useState<Edge | null>(null)
  const [clusterAgentId, setClusterAgentId] = useState<string | null>(null)

  // SSE stream state — shared by both entry points
  const { state: streamState, start, stop, loadHistorical } = useDebateStream()

  // External data from aggregator service
  const [domainLabels, setDomainLabels] = useState<Record<string, string>>({})
  const [zhihuUsers, setZhihuUsers] = useState<ExternalUser[]>([])
  const [zhihuQuestions, setZhihuQuestions] = useState<ExternalQuestion[]>([])
  const [externalDataLoading, setExternalDataLoading] = useState(false)
  const [edgeDebates, setEdgeDebates] = useState<Record<string, Debate[]>>({})

  const space = state.space
  const edges = state.edges
  const agents = space?.agents ?? []

  const USER_AGENT_ID = '__user__'

  const agent = useMemo(() => {
    if (agentId === USER_AGENT_ID) {
      return {
        agent_id: USER_AGENT_ID,
        name: '你',
        stance: 'neutral',
        persona: '正在做重要决策的你。你的问题驱动了整个认知空间的生成，所有角色都在围绕你的困惑提供不同视角的思考。',
        summary: space?.query ?? '你的决策问题',
      } as Agent
    }
    return agents.find((a) => a.agent_id === agentId) ?? null
  }, [agents, agentId, space])

  const relatedEdges = useMemo(() => {
    if (!agentId || agentId === USER_AGENT_ID) return []
    const list = edges.filter((e) => e.source === agentId || e.target === agentId)
    list.sort((a, b) => b.conflict_score - a.conflict_score)
    return list
  }, [edges, agentId])

  // Load domain labels once
  useEffect(() => {
    api.getDomainLabels().then(setDomainLabels).catch(() => {})
  }, [])

  // Reset page when agent changes
  useEffect(() => {
    setPage('profile')
    setSelectedEdgeForDebate(null)
    setClusterAgentId(null)
    stop()
  }, [agentId, stop])

  // Use refs to avoid triggering useEffect on every callback re-creation
  const onDebatingChangeRef = useRef(onDebatingChange)
  onDebatingChangeRef.current = onDebatingChange
  const onExpandingChangeRef = useRef(onExpandingChange)
  onExpandingChangeRef.current = onExpandingChange

  // Stop stream when leaving debate page, and notify parent
  useEffect(() => {
    if (page !== 'debate') {
      stop()
      onDebatingChangeRef.current?.(null)
    }
  }, [page, stop])

  function getOpponent(edge: Edge): Agent | null {
    const id = edge.source === agentId ? edge.target : edge.source
    return agents.find((a) => a.agent_id === id) ?? null
  }

  function handleDebate(edge: Edge) {
    if (!space) return
    setSelectedEdgeForDebate(edge)
    setPage('debate')
    onDebatingChange?.([edge.source, edge.target])
    start(space.space_id, edge.edge_id, 2)
  }

  async function handleReviewDebate(edge: Edge) {
    if (!space) return
    const debates = edgeDebates[edge.edge_id]
    if (!debates || debates.length === 0) return
    const debate = debates[0]
    setSelectedEdgeForDebate(edge)
    onDebatingChange?.(debate.participants)
    loadHistorical(debate)
    setPage('debate')
  }

  async function handleExpand() {
    if (!space || !agent || agentId === USER_AGENT_ID) return
    setExpandLoading(true)
    onExpandingChange?.(agent.agent_id)
    try {
      const req: AgentExpandPayload = {
        query_hint: expandHint || `深入探讨 ${agent.name} 的观点`,
        num_agents: 2,
      }
      const updatedSpace = await api.expandAgent(space.space_id, agent.agent_id, req)
      // Extract only newly added agents to avoid overwriting edges via SET_SPACE
      const existingIds = new Set(space.agents.map((a) => a.agent_id))
      const newAgents = updatedSpace.agents.filter((a) => !existingIds.has(a.agent_id))
      dispatch({ type: 'APPEND_AGENTS', payload: { agents: newAgents } })
      // Re-compute edges so newly expanded agents participate in conflict ranking
      const edgesRes = await api.computeEdges(space.space_id)
      dispatch({ type: 'SET_EDGES', payload: edgesRes.edges })
      setExpandHint('')
    } catch (err) {
      console.error('Expand failed:', err)
      alert('展开节点失败，请重试')
    } finally {
      setExpandLoading(false)
      // Delay clearing the pulse until the new node has time to appear in the 3D scene
      setTimeout(() => {
        onExpandingChangeRef.current?.(null)
      }, 2500)
    }
  }

  async function loadClusterData(domain: string, query: string) {
    setExternalDataLoading(true)
    try {
      const [users, questions] = await Promise.all([
        api.getZhihuUsers(domain).catch(() => []),
        api.getZhihuQuestions(query).catch(() => []),
      ])
      setZhihuUsers(users)
      setZhihuQuestions(questions)
    } finally {
      setExternalDataLoading(false)
    }
  }

  // Load external data when entering cluster page
  useEffect(() => {
    if (page === 'cluster' && space) {
      const clusterAgent = clusterAgentId
        ? agents.find((a) => a.agent_id === clusterAgentId)
        : agent
      const domain = clusterAgent?.domain || 'startup'
      loadClusterData(domain, space.query)
    }
  }, [page, clusterAgentId, agent, space, agents])

  // Compute busy state: expand in progress or debate streaming/loading
  const isBusy = expandLoading || (page === 'debate' && (streamState.loading || (streamState.turns.length > 0 && !streamState.done)))
  const busyType: 'debate' | 'expand' | undefined = expandLoading ? 'expand' : (page === 'debate' && (streamState.loading || (streamState.turns.length > 0 && !streamState.done))) ? 'debate' : undefined

  useEffect(() => {
    onBusyChange?.(isBusy, busyType)
  }, [isBusy, busyType, onBusyChange])

  // Fetch debate history for related edges
  useEffect(() => {
    if (relatedEdges.length === 0) {
      setEdgeDebates({})
      return
    }
    let cancelled = false

    Promise.all(
      relatedEdges.map(async (edge) => {
        try {
          const debates = await api.getDebatesByEdge(edge.edge_id)
          return { edgeId: edge.edge_id, debates }
        } catch {
          return { edgeId: edge.edge_id, debates: [] as Debate[] }
        }
      })
    ).then((results) => {
      if (cancelled) return
      const map: Record<string, Debate[]> = {}
      results.forEach((r) => {
        map[r.edgeId] = r.debates
      })
      setEdgeDebates(map)
    })
    return () => { cancelled = true }
  }, [relatedEdges])

  if (!agentId || !agent) return null

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-indigo-100 shadow-2xl z-50 flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {/* Profile */}
        <div className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${page === 'profile' ? 'translate-x-0' : 'translate-x-full'}`}>
          <ProfileContent
            agent={agent}
            relatedEdges={relatedEdges}
            getOpponent={getOpponent}
            onDebate={handleDebate}
            onReviewDebate={handleReviewDebate}
            edgeDebates={edgeDebates}
            onClose={onClose}
            expandHint={expandHint}
            setExpandHint={setExpandHint}
            expandLoading={expandLoading}
            onExpand={handleExpand}
            agentDepth={agent ? getDepth(agent, agents) : 0}
            childCount={agents.filter((a) => a.parent_id === agent?.agent_id).length}
            isUserAgent={agentId === USER_AGENT_ID}
            stanceColors={stanceColors}
            onCluster={(id) => { setClusterAgentId(id); setPage('cluster') }}
            isBusy={isBusy}
            onShowBusyToast={onShowBusyToast}
          />
        </div>
        {/* Debate */}
        <div className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${page === 'debate' ? 'translate-x-0' : page === 'profile' ? 'translate-x-full' : '-translate-x-full'}`}>
          <DebateContent
            streamState={streamState}
            agents={agents}
            selectedEdge={selectedEdgeForDebate}
            onBack={() => setPage('profile')}
            onCluster={(id) => { setClusterAgentId(id); setPage('cluster') }}
            stanceColors={stanceColors}
            isBusy={isBusy}
            onShowBusyToast={onShowBusyToast}
          />
        </div>
        {/* Cluster */}
        <div className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${page === 'cluster' ? 'translate-x-0' : 'translate-x-full'}`}>
          <ClusterContent
            agentDomain={clusterAgentId ? (agents.find((a) => a.agent_id === clusterAgentId)?.domain ?? agent.domain) : agent.domain}
            agentStance={clusterAgentId ? (agents.find((a) => a.agent_id === clusterAgentId)?.stance ?? agent.stance) : agent.stance}
            domainLabels={domainLabels}
            zhihuUsers={zhihuUsers}
            zhihuQuestions={zhihuQuestions}
            loading={externalDataLoading}
            onBack={() => setPage('profile')}
            stanceColors={stanceColors}
          />
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Profile Page ─────────────── */
function ProfileContent({
  agent,
  relatedEdges,
  getOpponent,
  onDebate,
  onReviewDebate,
  edgeDebates,
  onClose,
  expandHint,
  setExpandHint,
  expandLoading,
  onExpand,
  agentDepth,
  childCount,
  isUserAgent,
  stanceColors,
  onCluster,
  isBusy,
  onShowBusyToast,
}: {
  agent: Agent
  relatedEdges: Edge[]
  getOpponent: (edge: Edge) => Agent | null
  onDebate: (edge: Edge) => void
  onReviewDebate: (edge: Edge) => void
  edgeDebates: Record<string, Debate[]>
  onClose: () => void
  expandHint: string
  setExpandHint: (v: string) => void
  expandLoading: boolean
  onExpand: () => void
  agentDepth: number
  childCount: number
  isUserAgent: boolean
  stanceColors: ReturnType<typeof getStanceColors>
  onCluster: (agentId: string) => void
  isBusy: boolean
  onShowBusyToast?: () => void
}) {
  const { theme } = useTheme()
  const accent = THEMES.find((t) => t.id === theme)?.accent || '#3b82f6'
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-50">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-gray-700">角色详情</h3>
        </div>
        <button onClick={() => { if (isBusy) { onShowBusyToast?.(); return } onClose() }} className={`p-2 rounded-xl transition-colors ${isBusy ? 'opacity-30 cursor-not-allowed' : 'hover:bg-indigo-50'}`}>
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-bounce pb-8">
        <div className="p-5 border-b border-indigo-50">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl shrink-0">
              {agent.stance === 'pro' ? '✅' : agent.stance === 'con' ? '❌' : '⚖️'}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">{agent.name}</h2>
              <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mt-1" style={{ backgroundColor: stanceColors[agent.stance as keyof typeof stanceColors]?.bg || '#f3f4f6', color: stanceColors[agent.stance as keyof typeof stanceColors]?.text || '#374151' }}>
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
            <p className="text-sm text-gray-700 leading-relaxed font-medium bg-indigo-50 rounded-xl p-3">{agent.summary}</p>
          </div>

          {/* Cluster link */}
          {!isUserAgent && (
            <div className="mt-3">
              <button
                onClick={() => onCluster(agent.agent_id)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-indigo-100 text-indigo-500 text-xs font-bold transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                查看该角色的知乎相关用户和话题
              </button>
            </div>
          )}

          {/* Expand section */}
          {!isUserAgent && agentDepth < 2 && childCount < 4 && (
            <div className="mt-4 pt-4 border-t border-indigo-50">
              <p className="text-xs text-gray-400 font-bold mb-2">展开探索</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={expandHint}
                  onChange={(e) => setExpandHint(e.target.value)}
                  placeholder={`深入探讨 ${agent.name} 的观点...`}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-indigo-100 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  disabled={expandLoading}
                />
                <button
                  onClick={() => { if (isBusy) { onShowBusyToast?.(); return } onExpand() }}
                  disabled={expandLoading}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-400 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
                >
                  {expandLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                  展开
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">基于此角色生成新的关联视角</p>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Swords className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-extrabold text-gray-700">冲突排行榜</h3>
            <span className="text-xs text-gray-400 ml-auto">与该角色分歧最大的对手</span>
          </div>

          {relatedEdges.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {agent.agent_id === '__user__' ? '所有角色都在为你的决策提供不同视角' : '暂无冲突数据'}
            </p>
          )}

          <div className="space-y-3">
            {relatedEdges.map((edge) => {
              const opponent = getOpponent(edge)
              if (!opponent) return null
              return (
                <div key={edge.edge_id} className="p-4 rounded-2xl border border-indigo-100 bg-white shadow-sm hover:bg-gray-50/50 hover:border-indigo-50 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{opponent.stance === 'pro' ? '✅' : opponent.stance === 'con' ? '❌' : '⚖️'}</span>
                      <span className="text-sm font-bold text-gray-700">{opponent.name}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${edge.conflict_type === 'fundamental' ? 'bg-rose-100 text-rose-600' : edge.conflict_type === 'partial' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                      冲突 {(edge.conflict_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {edge.divergence_axes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {edge.divergence_axes.map((axis, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-bold">{axis.axis}</span>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const hasHistory = (edgeDebates[edge.edge_id]?.length ?? 0) > 0
                    return hasHistory ? (
                      <div className="flex gap-2">
                        <button onClick={() => { if (isBusy) { onShowBusyToast?.(); return } onDebate(edge) }} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-400 text-white text-xs font-bold transition-all ${isBusy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500'}`}>
                          <MessageSquare className="w-3.5 h-3.5" />
                          观看他们辩论
                        </button>
                        <button
                          onClick={() => { if (isBusy) { onShowBusyToast?.(); return } onReviewDebate(edge) }}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-bold transition-all ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                          style={{ backgroundColor: accent, opacity: 0.9 }}
                          onMouseEnter={(e) => { if (!isBusy) (e.target as HTMLElement).style.opacity = '1' }}
                          onMouseLeave={(e) => { if (!isBusy) (e.target as HTMLElement).style.opacity = '0.9' }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          回顾辩论
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { if (isBusy) { onShowBusyToast?.(); return } onDebate(edge) }} className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-400 text-white text-xs font-bold transition-all ${isBusy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500'}`}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        观看他们辩论
                      </button>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────── Debate Page ─────────────── */
function DebateContent({
  streamState,
  agents,
  selectedEdge,
  onBack,
  onCluster,
  stanceColors,
  isBusy,
  onShowBusyToast,
}: {
  streamState: ReturnType<typeof useDebateStream>['state']
  agents: Agent[]
  selectedEdge: Edge | null
  onBack: () => void
  onCluster: (agentId: string) => void
  stanceColors: ReturnType<typeof getStanceColors>
  isBusy: boolean
  onShowBusyToast?: () => void
}) {
  const [typedTurns, setTypedTurns] = useState<Set<number>>(new Set())
  const agentMap = new Map(agents.map((a) => [a.agent_id, a]))

  // Mark previous turns as fully typed; latest gets typing effect then auto-marked
  useEffect(() => {
    const turns = streamState.turns
    if (turns.length === 0) return
    const newTyped = new Set(typedTurns)
    for (let i = 0; i < turns.length - 1; i++) {
      newTyped.add(i)
    }
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

  const participants = selectedEdge
    ? [agents.find((a) => a.agent_id === selectedEdge.source), agents.find((a) => a.agent_id === selectedEdge.target)].filter(Boolean) as Agent[]
    : agents.slice(0, 2)

  const loading = streamState.loading && streamState.turns.length === 0
  const hasError = !!streamState.error
  const hasContent = streamState.turns.length > 0 || streamState.synthesis

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-indigo-50">
        <button onClick={() => { if (isBusy) { onShowBusyToast?.(); return } onBack() }} className={`p-2 rounded-xl transition-colors ${isBusy ? 'opacity-30 cursor-not-allowed' : 'hover:bg-indigo-50'}`}>
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-gray-700">💬 结构化辩论</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-5 scroll-bounce">
        {/* Participants header */}
        {!loading && hasContent && (
          <div className="pb-3 border-b border-indigo-50">
            <p className="text-[10px] text-gray-400 font-bold mb-2">参与辩论的角色</p>
            <div className="flex items-center gap-3">
              {participants.map((p) => {
                const color = stanceColors[p.stance as keyof typeof stanceColors]?.text || '#94a3b8'
                return (
                  <button key={p.agent_id} onClick={() => onCluster(p.agent_id)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: color + '30' }}>
                      {p.stance === 'pro' ? '✅' : p.stance === 'con' ? '❌' : '⚖️'}
                    </div>
                    <span className="text-xs font-bold text-gray-600">{p.name}</span>
                  </button>
                )
              })}
              <div className="ml-auto text-[10px] text-indigo-400 font-bold animate-pulse">点击查看聚类 →</div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-gray-400 font-bold">正在生成结构化辩论...</p>
          </div>
        )}

        {/* Error */}
        {hasError && !hasContent && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm text-gray-400 font-bold">辩论生成失败，请重试</p>
            <button onClick={onBack} className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-500 text-xs font-bold">返回</button>
          </div>
        )}

        {/* Turns */}
        {streamState.turns.length > 0 && (
          <div className="space-y-4">
            {streamState.turns.map((turn, idx) => {
              const isLatest = idx === streamState.turns.length - 1
              const isTypingThis = isLatest && !typedTurns.has(idx)
              const isFirstOfRound = idx === 0 || streamState.turns[idx].round !== streamState.turns[idx - 1].round

              return (
                <div key={`${turn.round}-${turn.agent}-${idx}`} className="space-y-3">
                  {isFirstOfRound && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Round {turn.round}</span>
                      <div className="flex-1 h-px bg-indigo-50" />
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
          </div>
        )}

        {/* Synthesis */}
        {streamState.synthesis && (
          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-extrabold text-gray-700">核心冲突</span>
            </div>
            <p className="text-xs text-gray-700 bg-white rounded-xl p-3 border border-indigo-50">{streamState.synthesis.core_conflict}</p>

            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-extrabold text-gray-700">给你的建议</span>
            </div>
            <p className="text-xs text-indigo-600 font-bold bg-indigo-50 rounded-xl p-3 border border-indigo-100">{streamState.synthesis.resolution_suggestion}</p>

            {streamState.synthesis.agreement_points.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-gray-400 mb-1.5">双方共识</div>
                <div className="flex flex-wrap gap-1.5">
                  {streamState.synthesis.agreement_points.map((pt, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-green-100 text-green-600 border border-green-200 font-bold">
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
    </>
  )
}

/* ─────────────── Cluster Page ─────────────── */
function ClusterContent({
  agentDomain,
  agentStance,
  domainLabels,
  zhihuUsers,
  zhihuQuestions,
  loading,
  onBack,
  stanceColors,
}: {
  agentDomain?: string
  agentStance: string
  domainLabels: Record<string, string>
  zhihuUsers: ExternalUser[]
  zhihuQuestions: ExternalQuestion[]
  loading: boolean
  onBack: () => void
  stanceColors: ReturnType<typeof getStanceColors>
}) {
  const domainLabel = domainLabels[agentDomain ?? ''] ?? (agentDomain || '未知领域')
  const color = stanceColors[agentStance as keyof typeof stanceColors]?.text || '#94a3b8'

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-indigo-50">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-indigo-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-gray-700">角色聚类</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6 scroll-bounce">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            <div>
              <p className="text-xs text-gray-400 font-bold mb-3">参考知乎问题</p>
              <div className="space-y-2">
                {zhihuQuestions.map((q, i) => (
                  <a key={i} href={q.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-50 hover:bg-white hover:shadow-sm hover:border-indigo-100 transition-all">
                    <ExternalLink className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate">{q.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{q.views} 浏览 · 知乎</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-bold mb-3">{domainLabel} · 知乎上的对应用户</p>
              <div className="space-y-3">
                {zhihuUsers.map((user, idx) => (
                  <a key={idx} href={user.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-3 rounded-xl bg-white border border-indigo-50 hover:bg-indigo-50/30 hover:border-indigo-100 transition-all">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: color + '20' }}>
                      {user.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-gray-800">{user.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: color + '20', color }}>
                          {domainLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{user.title}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{user.followers} 关注者</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 shrink-0 mt-2" />
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
