import { useState, useMemo, useRef, useEffect } from 'react'
import { useSpaceState } from '../store/SpaceContext'
import { ArrowLeft } from 'lucide-react'
import type { Agent } from '../api-types'

const W = 1000
const H = 1000
const CX = W / 2
const CY = H / 2
const RADIUS = 320
const SIDEBAR_WIDTH = 384 // AgentPanel max-w-md

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
  onBackToGlobal: () => void
}

export default function SpaceScene({
  onAgentClick,
  selectedAgent,
  viewMode,
  onBackToGlobal,
}: Props) {
  const { state } = useSpaceState()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoveredCenter, setHoveredCenter] = useState(false)
  const [transform, setTransform] = useState('none')
  const [transformOrigin, setTransformOrigin] = useState('50% 50%')

  const space = state.space
  const agents = space?.agents ?? []
  const isFocus = viewMode === 'focus'

  // Global positions (all agents around center)
  const globalPositions = useMemo(() => {
    const map = new Map<string, [number, number]>()
    const count = agents.length
    agents.forEach((agent, i) => {
      const angle = (360 / count) * i
      map.set(agent.agent_id, polarToCartesian(CX, CY, RADIUS, angle))
    })
    return map
  }, [agents])

  // Compute CSS transform for focus mode
  useEffect(() => {
    if (!containerRef.current || !isFocus || !selectedAgent) {
      setTransform('none')
      setTransformOrigin('50% 50%')
      return
    }

    const pos = globalPositions.get(selectedAgent)
    if (!pos) return

    const rect = containerRef.current.getBoundingClientRect()
    const scale = 1.7

    // SVG is rendered with preserveAspectRatio="xMidYMid meet"
    const svgScale = Math.min(rect.width, rect.height) / W
    const svgOffsetX = (rect.width - W * svgScale) / 2
    const svgOffsetY = (rect.height - H * svgScale) / 2

    // Character position on screen
    const charScreenX = svgOffsetX + pos[0] * svgScale
    const charScreenY = svgOffsetY + pos[1] * svgScale

    // Visible center considering sidebar
    const visibleCenterX = (rect.width - SIDEBAR_WIDTH) / 2
    const visibleCenterY = rect.height / 2

    // Translate to move character to visible center
    const dx = visibleCenterX - charScreenX
    const dy = visibleCenterY - charScreenY

    setTransform(`translate(${dx}px, ${dy}px) scale(${scale})`)
    setTransformOrigin(`${charScreenX}px ${charScreenY}px`)
  }, [isFocus, selectedAgent, globalPositions])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#f0f4ff]"
    >
      {/* Back button — inside canvas area, top-left, below metrics */}
      {isFocus && (
        <button
          onClick={onBackToGlobal}
          className="absolute top-4 left-4 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg border border-indigo-100 text-indigo-500 hover:bg-indigo-50 hover:scale-105 transition-all"
          title="返回全局视图"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* SVG container with animated transform */}
      <div
        className="w-full h-full transition-transform duration-500 ease-out"
        style={{ transform, transformOrigin }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          {/* Background reference circles */}
          <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#e0e7ff" strokeWidth="2" />
          <circle cx={CX} cy={CY} r={RADIUS * 0.6} fill="none" stroke="#e0e7ff" strokeWidth="1" />

          {/* Lines: center -> each agent */}
          {agents.map((agent) => {
            const pos = globalPositions.get(agent.agent_id)
            if (!pos) return null
            const color = STANCE_COLORS[agent.stance] || '#94a3b8'
            const isSel = selectedAgent === agent.agent_id
            const isHov = hoveredAgent === agent.agent_id
            const opacity = isSel ? 0.7 : isHov ? 0.5 : 0.25
            const strokeWidth = isSel ? 4 : isHov ? 3 : 2

            return (
              <line
                key={`line-${agent.agent_id}`}
                x1={CX}
                y1={CY}
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
          })}

          {/* Center node "You" */}
          <g
            onMouseEnter={() => setHoveredCenter(true)}
            onMouseLeave={() => setHoveredCenter(false)}
          >
            <circle
              cx={CX}
              cy={CY}
              r={hoveredCenter ? 52 : 48}
              fill={CENTER_COLOR}
              opacity={0.9}
              style={{ transition: 'r 0.2s' }}
            />
            <circle
              cx={CX}
              cy={CY}
              r={hoveredCenter ? 58 : 54}
              fill="none"
              stroke={CENTER_COLOR}
              strokeWidth={3}
              opacity={0.3}
              style={{ transition: 'r 0.2s' }}
            />
            <text x={CX} y={CY - 6} textAnchor="middle" fill="white" fontSize="28">
              👤
            </text>
            <text x={CX} y={CY + 18} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
              你
            </text>
          </g>

          {/* Agent nodes */}
          {agents.map((agent) => {
            const pos = globalPositions.get(agent.agent_id)
            if (!pos) return null
            const color = STANCE_COLORS[agent.stance] || '#94a3b8'
            const isSel = selectedAgent === agent.agent_id
            const isHov = hoveredAgent === agent.agent_id
            const r = isSel ? 40 : isHov ? 34 : 28

            return (
              <g
                key={agent.agent_id}
                onMouseEnter={() => setHoveredAgent(agent.agent_id)}
                onMouseLeave={() => setHoveredAgent(null)}
                onClick={() => onAgentClick(agent.agent_id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Selection ring with pulse */}
                {isSel && (
                  <circle
                    cx={pos[0]}
                    cy={pos[1]}
                    r={r + 12}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    opacity={0.4}
                  >
                    <animate
                      attributeName="r"
                      values={`${r + 10};${r + 16};${r + 10}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                <circle
                  cx={pos[0]}
                  cy={pos[1]}
                  r={r}
                  fill={color}
                  opacity={0.9}
                  style={{ transition: 'r 0.3s' }}
                />

                <text
                  x={pos[0]}
                  y={pos[1] + 6}
                  textAnchor="middle"
                  fontSize={isSel ? '24' : '20'}
                >
                  {agent.stance === 'pro' ? '✅' : agent.stance === 'con' ? '❌' : '⚖️'}
                </text>

                {/* Name label */}
                <foreignObject
                  x={pos[0] - 60}
                  y={pos[1] + r + 10}
                  width={120}
                  height={40}
                >
                  <div
                    className="flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-sm"
                    style={{
                      color: '#fff',
                      backgroundColor: color,
                      border: '2px solid #fff',
                      boxShadow: isSel
                        ? `0 0 0 3px ${color}40, 0 4px 12px ${color}60`
                        : `0 2px 8px ${color}60`,
                      display: 'inline-block',
                    }}
                  >
                    {agent.name}
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </svg>
      </div>

      {/* HTML Tooltip overlays */}
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

function AgentTooltip({
  agent,
  onMouseEnter,
  onMouseLeave,
}: {
  agent: Agent
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const color = STANCE_COLORS[agent.stance] || '#94a3b8'
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-4 py-3 rounded-2xl bg-white border-2 border-indigo-100 shadow-xl whitespace-nowrap">
        <div className="text-xs font-extrabold" style={{ color }}>
          {agent.stance === 'pro' ? '✅ 支持' : agent.stance === 'con' ? '❌ 反对' : '⚖️ 中立'}
        </div>
        <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">
          {agent.summary}
        </div>
        <div className="text-[10px] text-gray-400 font-mono mt-1">
          权威: {agent.position.authority.toFixed(2)} · 新颖: {agent.position.novelty.toFixed(2)}
        </div>
      </div>
    </div>
  )
}

function CenterTooltip({
  onMouseEnter,
  onMouseLeave,
}: {
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-4 py-2 rounded-2xl bg-white border-2 border-indigo-100 shadow-xl whitespace-nowrap">
        <div className="text-xs font-extrabold text-indigo-400">🌟 你的决策问题</div>
        <div className="text-xs text-gray-400 mt-0.5">所有观点围绕你的问题展开</div>
      </div>
    </div>
  )
}
