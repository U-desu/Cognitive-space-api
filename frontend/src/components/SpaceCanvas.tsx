import { useRef, useState } from 'react'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'

const W = 1000
const H = 1000
const PAD = 80

function scaleX(v: number) {
  return PAD + v * (W - 2 * PAD)
}
function scaleY(v: number) {
  return H - PAD - v * (H - 2 * PAD)
}

const STANCE_COLORS: Record<string, string> = {
  pro: '#06b6d4',
  con: '#ef4444',
  neutral: '#f59e0b',
}

interface Props {
  onEdgeClick: (edgeId: string) => void
}

export default function SpaceCanvas({ onEdgeClick }: Props) {
  const { state, dispatch } = useSpaceState()
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)

  const space = state.space
  const edges = state.edges
  const agents = space?.agents ?? []

  async function handleEdgeClick(edgeId: string) {
    if (!space) return
    const edge = edges.find((e) => e.edge_id === edgeId)
    if (!edge) return

    // Record trajectory
    try {
      await api.createDebate(space.space_id, {
        edge_id: edgeId,
        format: 'structured',
        rounds: 2,
      })
    } catch {
      // Mock mode may not need real debate for UI
    }

    onEdgeClick(edgeId)
  }

  async function handleAgentClick(_agentId: string) {
    if (!space) return
    // Refresh trajectory
    try {
      const traj = await api.getTrajectory(space.space_id)
      dispatch({ type: 'SET_TRAJECTORY', payload: traj })
    } catch {
      // ignore
    }
  }

  if (!space) return null

  return (
    <div className="w-full h-full overflow-auto p-6 flex items-center justify-center">
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

        {/* Edges */}
        {edges.map((edge) => {
          const a = agents.find((ag) => ag.agent_id === edge.source)
          const b = agents.find((ag) => ag.agent_id === edge.target)
          if (!a || !b) return null
          const isFundamental = edge.conflict_type === 'fundamental'
          const isHovered = hoveredEdge === edge.edge_id
          return (
            <g key={edge.edge_id}>
              <line
                x1={scaleX(a.position.authority)}
                y1={scaleY(a.position.novelty)}
                x2={scaleX(b.position.authority)}
                y2={scaleY(b.position.novelty)}
                stroke={isFundamental ? '#d946ef' : '#475569'}
                strokeWidth={Math.max(1, edge.conflict_score * 8)}
                strokeDasharray={isFundamental ? '6,4' : '0'}
                opacity={isHovered ? 1 : 0.6}
                className={isFundamental ? 'animate-dash' : ''}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredEdge(edge.edge_id)}
                onMouseLeave={() => setHoveredEdge(null)}
                onClick={() => handleEdgeClick(edge.edge_id)}
              />
              {isHovered && (
                <text
                  x={(scaleX(a.position.authority) + scaleX(b.position.authority)) / 2}
                  y={(scaleY(a.position.novelty) + scaleY(b.position.novelty)) / 2 - 10}
                  textAnchor="middle"
                  fill="#d946ef"
                  fontSize="12"
                  fontFamily="monospace"
                >
                  {edge.conflict_score.toFixed(2)}
                </text>
              )}
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
                r={isHovered ? 18 : 14}
                fill={color}
                opacity={0.85}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth={2}
              >
                {isHovered && (
                  <animate attributeName="r" values="16;20;16" dur="1.5s" repeatCount="indefinite" />
                )}
              </circle>
              <text
                x={cx}
                y={cy + 32}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="12"
                fontWeight="500"
              >
                {agent.name}
              </text>
              {isHovered && (
                <g>
                  <rect
                    x={cx - 80}
                    y={cy - 90}
                    width="160"
                    height="70"
                    rx="8"
                    fill="#12121a"
                    stroke="#1e1e2e"
                    strokeWidth="1"
                  />
                  <text x={cx} y={cy - 72} textAnchor="middle" fill={color} fontSize="11" fontWeight="600">
                    {agent.stance.toUpperCase()}
                  </text>
                  <text x={cx} y={cy - 55} textAnchor="middle" fill="#94a3b8" fontSize="10">
                    {agent.summary?.slice(0, 30)}...
                  </text>
                  <text x={cx} y={cy - 38} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="monospace">
                    auth: {agent.position.authority.toFixed(2)} · nov: {agent.position.novelty.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
