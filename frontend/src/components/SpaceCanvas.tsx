import { useRef, useState, useMemo } from 'react'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import type { Edge } from '../api-types'

const W = 1000
const H = 1000
const PAD = 80

const STANCE_COLORS: Record<string, string> = {
  pro: '#06b6d4',
  con: '#ef4444',
  neutral: '#f59e0b',
}

interface Props {
  onEdgeClick: (edgeId: string) => void
}

function hashOffset(edgeId: string, maxOffset: number): number {
  let hash = 0
  for (let i = 0; i < edgeId.length; i++) {
    hash = ((hash << 5) - hash) + edgeId.charCodeAt(i)
    hash |= 0
  }
  const normalized = (Math.abs(hash) % 1000) / 1000
  return (normalized - 0.5) * 2 * maxOffset
}

export default function SpaceCanvas({ onEdgeClick }: Props) {
  const { state, dispatch } = useSpaceState()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [edgeTooltip, setEdgeTooltip] = useState<{
    x: number
    y: number
    edge: Edge
    sourceName: string
    targetName: string
  } | null>(null)

  const space = state.space
  const edges = state.edges
  const agents = space?.agents ?? []

  // Adaptive coordinate mapping: stretch data range to full canvas
  const { scaleX, scaleY } = useMemo(() => {
    if (agents.length === 0) {
      return {
        scaleX: (v: number) => PAD + v * (W - 2 * PAD),
        scaleY: (v: number) => H - PAD - v * (H - 2 * PAD),
      }
    }
    const authVals = agents.map((a) => a.position.authority)
    const novVals = agents.map((a) => a.position.novelty)
    const authMin = Math.max(0, Math.min(...authVals) - 0.08)
    const authMax = Math.min(1, Math.max(...authVals) + 0.08)
    const novMin = Math.max(0, Math.min(...novVals) - 0.08)
    const novMax = Math.min(1, Math.max(...novVals) + 0.08)

    return {
      scaleX: (v: number) => {
        const t = (v - authMin) / (authMax - authMin)
        return PAD + t * (W - 2 * PAD)
      },
      scaleY: (v: number) => {
        const t = (v - novMin) / (novMax - novMin)
        return H - PAD - t * (H - 2 * PAD)
      },
    }
  }, [agents])

  // Filter edges: only show meaningful connections
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => e.conflict_score > 0.25)
  }, [edges])

  async function handleEdgeClick(edgeId: string) {
    if (!space) return
    try {
      await api.createDebate(space.space_id, {
        edge_id: edgeId,
        format: 'structured',
        rounds: 2,
      })
    } catch {
      // Mock mode fallback
    }
    onEdgeClick(edgeId)
  }

  async function handleAgentClick(_agentId: string) {
    if (!space) return
    try {
      const traj = await api.getTrajectory(space.space_id)
      dispatch({ type: 'SET_TRAJECTORY', payload: traj })
    } catch {
      // ignore
    }
  }

  function handleEdgeMouseMove(
    e: React.MouseEvent,
    edge: Edge
  ) {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const source = agents.find((a) => a.agent_id === edge.source)
    const target = agents.find((a) => a.agent_id === edge.target)
    setEdgeTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      edge,
      sourceName: source?.name ?? edge.source,
      targetName: target?.name ?? edge.target,
    })
  }

  if (!space) return null

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto p-6 flex items-center justify-center relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-5xl aspect-square bg-space-surface rounded-2xl border border-space-border"
      >
        {/* Grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(6,182,212,0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {/* Axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" strokeWidth="2" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#334155" strokeWidth="2" />

        {/* Axis labels */}
        <text x={W / 2} y={H - 20} textAnchor="middle" fill="#64748b" fontSize="14" fontFamily="monospace">
          authority →
        </text>
        <text x={30} y={H / 2} textAnchor="middle" fill="#64748b" fontSize="14" fontFamily="monospace" transform={`rotate(-90, 30, ${H / 2})`}>
          novelty →
        </text>

        {/* Edges as Bezier curves */}
        {visibleEdges.map((edge) => {
          const a = agents.find((ag) => ag.agent_id === edge.source)
          const b = agents.find((ag) => ag.agent_id === edge.target)
          if (!a || !b) return null
          const isFundamental = edge.conflict_type === 'fundamental'
          const isHovered = hoveredEdge === edge.edge_id
          const x1 = scaleX(a.position.authority)
          const y1 = scaleY(a.position.novelty)
          const x2 = scaleX(b.position.authority)
          const y2 = scaleY(b.position.novelty)

          // Quadratic Bezier control point with perpendicular offset
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const dx = x2 - x1
          const dy = y2 - y1
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          const offset = hashOffset(edge.edge_id, Math.min(len * 0.15, 60))
          const cx = mx - (dy / len) * offset
          const cy = my + (dx / len) * offset

          const opacity = isHovered ? 1 : 0.35 + edge.conflict_score * 0.65
          const strokeWidth = Math.max(1.5, edge.conflict_score * 7)

          return (
            <g key={edge.edge_id}>
              <path
                d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                fill="none"
                stroke={isFundamental ? '#d946ef' : '#64748b'}
                strokeWidth={strokeWidth}
                strokeDasharray={isFundamental ? '5,4' : '0'}
                opacity={opacity}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHoveredEdge(edge.edge_id)}
                onMouseLeave={() => {
                  setHoveredEdge(null)
                  setEdgeTooltip(null)
                }}
                onMouseMove={(e) => handleEdgeMouseMove(e, edge)}
                onClick={() => handleEdgeClick(edge.edge_id)}
              />
            </g>
          )
        })}

        {/* Agents */}
        {agents.map((agent) => {
          const cx = scaleX(agent.position.authority)
          const cy = scaleY(agent.position.novelty)
          const color = STANCE_COLORS[agent.stance] || '#94a3b8'
          const isHovered = hoveredAgent === agent.agent_id
          return (
            <g
              key={agent.agent_id}
              onMouseEnter={() => setHoveredAgent(agent.agent_id)}
              onMouseLeave={() => setHoveredAgent(null)}
              onClick={() => handleAgentClick(agent.agent_id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 20 : 15}
                fill={color}
                opacity={0.85}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth={2}
                style={{ transition: 'r 0.2s' }}
              />
              <text
                x={cx}
                y={cy + 34}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="12"
                fontWeight="500"
                style={{ pointerEvents: 'none' }}
              >
                {agent.name}
              </text>
              {isHovered && (
                <g>
                  <rect
                    x={cx - 85}
                    y={cy - 100}
                    width="170"
                    height="78"
                    rx="8"
                    fill="#12121a"
                    stroke="#1e1e2e"
                    strokeWidth="1"
                    opacity={0.95}
                  />
                  <text x={cx} y={cy - 80} textAnchor="middle" fill={color} fontSize="11" fontWeight="600">
                    {agent.stance.toUpperCase()}
                  </text>
                  <text x={cx} y={cy - 62} textAnchor="middle" fill="#94a3b8" fontSize="10">
                    {agent.summary?.slice(0, 32)}...
                  </text>
                  <text x={cx} y={cy - 44} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
                    auth: {agent.position.authority.toFixed(2)} · nov: {agent.position.novelty.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* HTML Edge Tooltip */}
      {edgeTooltip && (
        <div
          className="absolute z-50 px-3 py-2.5 rounded-lg bg-space-surface border border-space-border shadow-2xl pointer-events-none"
          style={{
            left: Math.min(edgeTooltip.x + 16, (containerRef.current?.clientWidth ?? 800) - 220),
            top: Math.max(edgeTooltip.y - 90, 8),
            minWidth: 180,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-space-cyan font-medium">{edgeTooltip.sourceName}</span>
            <span className="text-xs text-space-muted">↔</span>
            <span className="text-xs text-space-red font-medium">{edgeTooltip.targetName}</span>
          </div>
          <div className="text-sm font-mono font-bold text-space-magenta">
            冲突分数: {edgeTooltip.edge.conflict_score.toFixed(3)}
          </div>
          <div className="text-xs text-space-muted capitalize mt-0.5">
            {edgeTooltip.edge.conflict_type}
            {edgeTooltip.edge.debate_recommended && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-space-magenta/15 text-space-magenta text-[10px]">
                建议辩论
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
