import { useState, useMemo } from 'react'
import { useSpaceState } from '../store/SpaceContext'
import type { Agent } from '../api-types'

const W = 1000
const H = 1000

const STANCE_COLORS: Record<string, string> = {
  pro: '#4ade80',
  con: '#fb7185',
  neutral: '#fbbf24',
}

const CENTER_COLOR = '#818cf8'

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): [number, number] {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)]
}

interface Props {
  onAgentClick: (agentId: string) => void
  selectedAgent: string | null
  viewMode: 'global' | 'focus'
}

export default function SpaceScene({ onAgentClick, selectedAgent, viewMode }: Props) {
  const { state } = useSpaceState()
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoveredCenter, setHoveredCenter] = useState(false)

  const space = state.space
  const agents = space?.agents ?? []

  // Global view: agents around center "You"
  const globalPositions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    const count = agents.length
    const radius = 320
    agents.forEach((agent, i) => {
      const angle = (360 / count) * i
      map.set(agent.agent_id, polarToCartesian(W / 2, H / 2, radius, angle))
    })
    return map
  }, [agents])

  // Focus view: selected agent in center, "You" below, others in background
  const focusPositions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    if (!selectedAgent) return map

    const selected = agents.find((a) => a.agent_id === selectedAgent)
    if (!selected) return map

    // Selected agent at visual center
    map.set(selectedAgent, [W / 2, 400])

    // "You" at bottom center
    const youPos: [number, number] = [W / 2, 780]
    map.set('__center__', youPos)

    // Other agents distributed in background (upper semicircle + sides)
    const others = agents.filter((a) => a.agent_id !== selectedAgent)
    const count = others.length
    const radius = 400
    others.forEach((agent, i) => {
      // Distribute from -120° to +120° (avoid bottom where "You" is)
      const angle = -120 + (240 / Math.max(1, count - 1)) * i
      map.set(agent.agent_id, polarToCartesian(W / 2, 400, radius, angle))
    })

    return map
  }, [agents, selectedAgent])

  const isGlobal = viewMode === 'global'
  const positions = isGlobal ? globalPositions : focusPositions

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-[#f0f4ff]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full max-w-4xl max-h-[80vh] transition-opacity duration-500"
        style={{ aspectRatio: '1 / 1' }}
      >
        {/* Background reference circles (global only) */}
        {isGlobal && (
          <>
            <circle cx={W / 2} cy={H / 2} r={320} fill="none" stroke="#e0e7ff" strokeWidth="2" />
            <circle cx={W / 2} cy={H / 2} r={190} fill="none" stroke="#e0e7ff" strokeWidth="1" />
          </>
        )}

        {/* Star lines */}
        {isGlobal
          ? // Global: center -> each agent
            agents.map((agent) => {
              const pos = positions.get(agent.agent_id)
              if (!pos) return null
              const color = STANCE_COLORS[agent.stance] || '#94a3b8'
              const isSel = selectedAgent === agent.agent_id
              const isHov = hoveredAgent === agent.agent_id
              const opacity = isSel ? 0.7 : isHov ? 0.5 : 0.25
              const strokeWidth = isSel ? 4 : isHov ? 3 : 2
              return (
                <line
                  key={`line-${agent.agent_id}`}
                  x1={W / 2}
                  y1={H / 2}
                  x2={pos[0]}
                  y2={pos[1]}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  style={{ transition: 'all 0.3s', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredAgent(agent.agent_id)}
                  onMouseLeave={() => setHoveredAgent(null)}
                  onClick={() => onAgentClick(agent.agent_id)}
                />
              )
            })
          : // Focus: selected agent <-> "You" (thick), selected <-> others (thin)
            selectedAgent &&
            agents.map((agent) => {
              const selectedPos = positions.get(selectedAgent)
              const agentPos = positions.get(agent.agent_id)
              if (!selectedPos || !agentPos) return null
              if (agent.agent_id === selectedAgent) return null

              const color = STANCE_COLORS[agent.stance] || '#94a3b8'
              const isHov = hoveredAgent === agent.agent_id
              const isYou = agentPos[1] > 700 // roughly the "You" position
              const opacity = isYou ? 0.6 : isHov ? 0.35 : 0.18
              const strokeWidth = isYou ? 5 : 2

              return (
                <line
                  key={`line-${agent.agent_id}`}
                  x1={selectedPos[0]}
                  y1={selectedPos[1]}
                  x2={agentPos[0]}
                  y2={agentPos[1]}
                  stroke={isYou ? CENTER_COLOR : color}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  strokeDasharray={isYou ? '0' : '6,4'}
                  style={{ transition: 'all 0.3s', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredAgent(agent.agent_id)}
                  onMouseLeave={() => setHoveredAgent(null)}
                  onClick={() => onAgentClick(agent.agent_id)}
                />
              )
            })}

        {/* Center node "You" */}
        {isGlobal ? (
          <g
            onMouseEnter={() => setHoveredCenter(true)}
            onMouseLeave={() => setHoveredCenter(false)}
          >
            <circle cx={W / 2} cy={H / 2} r={hoveredCenter ? 52 : 48} fill={CENTER_COLOR} opacity={0.9} style={{ transition: 'r 0.2s' }} />
            <circle cx={W / 2} cy={H / 2} r={hoveredCenter ? 58 : 54} fill="none" stroke={CENTER_COLOR} strokeWidth={3} opacity={0.3} style={{ transition: 'r 0.2s' }} />
            <text x={W / 2} y={H / 2 - 6} textAnchor="middle" fill="white" fontSize="28">👤</text>
            <text x={W / 2} y={H / 2 + 18} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">你</text>
          </g>
        ) : (
          // Focus mode: "You" at bottom
          <g
            transform="translate(0, 0)"
            onMouseEnter={() => setHoveredCenter(true)}
            onMouseLeave={() => setHoveredCenter(false)}
          >
            <circle cx={W / 2} cy={780} r={hoveredCenter ? 42 : 38} fill={CENTER_COLOR} opacity={0.85} style={{ transition: 'r 0.2s' }} />
            <text x={W / 2} y={780 - 4} textAnchor="middle" fill="white" fontSize="22">👤</text>
            <text x={W / 2} y={780 + 16} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">你</text>
          </g>
        )}

        {/* Agent nodes */}
        {agents.map((agent) => {
          const pos = positions.get(agent.agent_id)
          if (!pos) return null
          const color = STANCE_COLORS[agent.stance] || '#94a3b8'
          const isSel = selectedAgent === agent.agent_id
          const isHov = hoveredAgent === agent.agent_id

          // Radius depends on mode and selection
          let r = 28
          if (isGlobal) {
            r = isSel ? 36 : isHov ? 32 : 28
          } else {
            r = isSel ? 70 : isHov ? 30 : 20
          }

          // Opacity for background agents in focus mode
          const opacity = !isGlobal && !isSel ? 0.45 : 0.9

          return (
            <g
              key={agent.agent_id}
              onMouseEnter={() => setHoveredAgent(agent.agent_id)}
              onMouseLeave={() => setHoveredAgent(null)}
              onClick={() => onAgentClick(agent.agent_id)}
              style={{ cursor: 'pointer' }}
              opacity={opacity}
            >
              {/* Selection / focus ring */}
              {isSel && (
                <circle
                  cx={pos[0]}
                  cy={pos[1]}
                  r={r + (isGlobal ? 10 : 16)}
                  fill="none"
                  stroke={color}
                  strokeWidth={isGlobal ? 3 : 4}
                  opacity={0.35}
                >
                  <animate attributeName="r" values={`${r + (isGlobal ? 8 : 14)};${r + (isGlobal ? 12 : 20)};${r + (isGlobal ? 8 : 14)}`} dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Main circle */}
              <circle cx={pos[0]} cy={pos[1]} r={r} fill={color} opacity={0.9} style={{ transition: 'r 0.3s' }} />

              {/* Emoji */}
              <text x={pos[0]} y={pos[1] + (isSel && !isGlobal ? 10 : 6)} textAnchor="middle" fontSize={isSel && !isGlobal ? '36' : '20'}>
                {agent.stance === 'pro' ? '✅' : agent.stance === 'con' ? '❌' : '⚖️'}
              </text>

              {/* Name label (hide for non-selected in focus mode) */}
              {(!isGlobal && !isSel) ? (
                // Small label for background agents
                <text x={pos[0]} y={pos[1] + r + 14} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="600">
                  {agent.name}
                </text>
              ) : (
                // Pill label for selected / global view
                <foreignObject x={pos[0] - 60} y={pos[1] + r + 10} width={120} height={40}>
                  <div
                    className="flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-sm"
                    style={{
                      color: '#fff',
                      backgroundColor: color,
                      border: '2px solid #fff',
                      boxShadow: isSel ? `0 0 0 3px ${color}40, 0 4px 12px ${color}60` : `0 2px 8px ${color}60`,
                      display: 'inline-block',
                    }}
                  >
                    {agent.name}
                  </div>
                </foreignObject>
              )}
            </g>
          )
        })}
      </svg>

      {/* HTML Tooltip overlay */}
      {hoveredAgent && (
        <AgentTooltip
          agent={agents.find((a) => a.agent_id === hoveredAgent)!}
          onMouseEnter={() => setHoveredAgent(hoveredAgent)}
          onMouseLeave={() => setHoveredAgent(null)}
        />
      )}
      {hoveredCenter && !hoveredAgent && (
        <CenterTooltip
          onMouseEnter={() => setHoveredCenter(true)}
          onMouseLeave={() => setHoveredCenter(false)}
        />
      )}
    </div>
  )
}

function AgentTooltip({ agent, onMouseEnter, onMouseLeave }: { agent: Agent; onMouseEnter: () => void; onMouseLeave: () => void }) {
  const color = STANCE_COLORS[agent.stance] || '#94a3b8'
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="px-4 py-3 rounded-2xl bg-white border-2 border-indigo-100 shadow-xl whitespace-nowrap">
        <div className="text-xs font-extrabold" style={{ color }}>
          {agent.stance === 'pro' ? '✅ 支持' : agent.stance === 'con' ? '❌ 反对' : '⚖️ 中立'}
        </div>
        <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">{agent.summary}</div>
        <div className="text-[10px] text-gray-400 font-mono mt-1">
          权威: {agent.position.authority.toFixed(2)} · 新颖: {agent.position.novelty.toFixed(2)}
        </div>
      </div>
    </div>
  )
}

function CenterTooltip({ onMouseEnter, onMouseLeave }: { onMouseEnter: () => void; onMouseLeave: () => void }) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="px-4 py-2 rounded-2xl bg-white border-2 border-indigo-100 shadow-xl whitespace-nowrap">
        <div className="text-xs font-extrabold text-indigo-400">🌟 你的决策问题</div>
        <div className="text-xs text-gray-400 mt-0.5">所有观点围绕你的问题展开</div>
      </div>
    </div>
  )
}
