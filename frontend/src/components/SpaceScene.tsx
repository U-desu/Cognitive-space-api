import { useState, useMemo, useRef, useEffect } from 'react'
import { useSpaceState } from '../store/SpaceContext'
import { ArrowLeft } from 'lucide-react'
import type { Agent } from '../api-types'

const W = 2000
const H = 2000
const CX = W / 2
const CY = H / 2
const ROOT_RADIUS = 380
const CHILD_RADIUS_BASE = 220
const SIDEBAR_WIDTH = 384

const STANCE_COLORS: Record<string, string> = {
  pro: '#4ade80',
  con: '#fb7185',
  neutral: '#fbbf24',
}

const CENTER_COLOR = '#818cf8'
const USER_AGENT_ID = '__user__'

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): [number, number] {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)]
}

/** Compute radial-tree layout: roots around center, children around parents. */
function computeRadialTreeLayout(agents: Agent[]): Map<string, [number, number]> {
  const positions = new Map<string, [number, number]>()
  const childrenMap = new Map<string, Agent[]>()

  for (const agent of agents) {
    if (agent.parent_id) {
      const list = childrenMap.get(agent.parent_id) || []
      list.push(agent)
      childrenMap.set(agent.parent_id, list)
    }
  }

  const roots = agents.filter((a) => !a.parent_id)
  const rootCount = Math.max(roots.length, 1)

  // Place roots around center
  roots.forEach((root, i) => {
    const angle = (360 / rootCount) * i
    positions.set(root.agent_id, polarToCartesian(CX, CY, ROOT_RADIUS, angle))
  })

  // Recursively place children
  function placeChildren(parentId: string, depth: number) {
    const children = childrenMap.get(parentId)
    if (!children || children.length === 0) return

    const parentPos = positions.get(parentId)
    if (!parentPos) return

    const childRadius = CHILD_RADIUS_BASE * Math.pow(0.72, depth)
    const angleOffset = depth * 40
    const count = children.length

    children.forEach((child, i) => {
      const baseAngle = (360 / count) * i + angleOffset
      // Stagger odd depths to reduce overlap
      const stagger = depth % 2 === 1 ? 180 / count : 0
      const angle = baseAngle + stagger
      positions.set(
        child.agent_id,
        polarToCartesian(parentPos[0], parentPos[1], childRadius, angle)
      )
      placeChildren(child.agent_id, depth + 1)
    })
  }

  roots.forEach((r) => placeChildren(r.agent_id, 0))

  // Also place any orphaned agents (shouldn't happen, but safe-guard)
  for (const agent of agents) {
    if (!positions.has(agent.agent_id)) {
      const orphanIdx = agents.indexOf(agent)
      const angle = (360 / agents.length) * orphanIdx
      positions.set(agent.agent_id, polarToCartesian(CX, CY, ROOT_RADIUS * 1.5, angle))
    }
  }

  return positions
}

interface Props {
  onAgentClick: (agentId: string) => void
  selectedAgent: string | null
  viewMode: 'global' | 'focus'
  onBackToGlobal: () => void
  onExpandAgent?: (agentId: string) => void
}

export default function SpaceScene({
  onAgentClick,
  selectedAgent,
  viewMode,
  onBackToGlobal,
  onExpandAgent,
}: Props) {
  const { state } = useSpaceState()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoveredCenter, setHoveredCenter] = useState(false)

  // User-controlled pan & zoom (active in both modes)
  const [userPan, setUserPan] = useState({ x: 0, y: 0 })
  const [userZoom, setUserZoom] = useState(1)
  const userPanRef = useRef(userPan)
  userPanRef.current = userPan

  // Focus base pan (computed to center selected agent)
  const [focusBasePan, setFocusBasePan] = useState({ x: 0, y: 0 })

  // Drag state to distinguish click vs drag
  const dragRef = useRef({
    isDown: false,
    hasDragged: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  })

  const space = state.space
  const agents = space?.agents ?? []
  const isFocus = viewMode === 'focus'

  // Build parent -> children map for lines
  const childrenMap = useMemo(() => {
    const map = new Map<string, Agent[]>()
    for (const a of agents) {
      if (a.parent_id) {
        const list = map.get(a.parent_id) || []
        list.push(a)
        map.set(a.parent_id, list)
      }
    }
    return map
  }, [agents])

  // Compute radial-tree positions
  const positions = useMemo(() => {
    return computeRadialTreeLayout(agents)
  }, [agents])

  // Compute focus base pan when entering focus or switching agent
  useEffect(() => {
    if (!selectedAgent || !containerRef.current) {
      setFocusBasePan({ x: 0, y: 0 })
      if (!isFocus) {
        setUserPan({ x: 0, y: 0 })
        setUserZoom(1)
      }
      return
    }

    let pos: [number, number] | undefined
    if (selectedAgent === USER_AGENT_ID) {
      pos = [CX, CY]
    } else {
      pos = positions.get(selectedAgent)
    }
    if (!pos) return

    const rect = containerRef.current.getBoundingClientRect()
    const svgScale = Math.min(rect.width, rect.height) / W
    const svgOffsetX = (rect.width - W * svgScale) / 2
    const svgOffsetY = (rect.height - H * svgScale) / 2

    // Character position on screen (before any transform)
    const charScreenX = svgOffsetX + pos[0] * svgScale
    const charScreenY = svgOffsetY + pos[1] * svgScale

    const screenCenterX = rect.width / 2
    const screenCenterY = rect.height / 2
    const visibleCenterX = isFocus ? (rect.width - SIDEBAR_WIDTH) / 2 : screenCenterX
    const visibleCenterY = rect.height / 2

    const baseScale = isFocus ? 1.7 : 1.0

    // After scale(baseScale) around screen center, character ends up at:
    const charAfterScaleX =
      screenCenterX + (charScreenX - screenCenterX) * baseScale
    const charAfterScaleY =
      screenCenterY + (charScreenY - screenCenterY) * baseScale

    // Need to pan to move character from there to visible center
    const basePanX = visibleCenterX - charAfterScaleX
    const basePanY = visibleCenterY - charAfterScaleY

    setFocusBasePan({ x: basePanX, y: basePanY })
  }, [isFocus, selectedAgent, positions])

  // Drag & zoom handlers (real-time, no damping)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.isDown) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragRef.current.hasDragged = true
      }
      setUserPan({
        x: dragRef.current.startPanX + dx,
        y: dragRef.current.startPanY + dy,
      })
    }

    const onUp = () => {
      dragRef.current.isDown = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY * -0.001
      setUserZoom((z) => {
        const next = z + delta
        return Math.min(3.0, Math.max(0.3, next))
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    const container = containerRef.current
    container?.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      container?.removeEventListener('wheel', onWheel)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      isDown: true,
      hasDragged: false,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: userPanRef.current.x,
      startPanY: userPanRef.current.y,
    }
  }

  const handleAgentClick = (agentId: string) => {
    if (dragRef.current.hasDragged) {
      dragRef.current.hasDragged = false
      return
    }
    setUserPan({ x: 0, y: 0 })
    setUserZoom(1)
    onAgentClick(agentId)
  }

  const handleCenterClick = () => {
    if (dragRef.current.hasDragged) {
      dragRef.current.hasDragged = false
      return
    }
    setUserPan({ x: 0, y: 0 })
    setUserZoom(1)
    if (isFocus) {
      onAgentClick(USER_AGENT_ID)
    } else {
      onBackToGlobal()
    }
  }

  const handleExpandClick = (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation()
    onExpandAgent?.(agentId)
  }

  // Final transform: fixed transformOrigin, only transform changes
  const finalScale = isFocus ? 1.7 * userZoom : userZoom
  const finalPanX = focusBasePan.x + userPan.x
  const finalPanY = focusBasePan.y + userPan.y

  const isDragging = dragRef.current.isDown

  // Center label: use space query abbreviation
  const centerLabel = useMemo(() => {
    if (!space?.query) return '问题'
    return space.query.length > 6 ? space.query.slice(0, 6) + '…' : space.query
  }, [space?.query])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#f0f4ff]"
      onMouseDown={handleMouseDown}
      style={{ userSelect: 'none' }}
    >
      {/* Back button (focus mode only) */}
      {isFocus && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onBackToGlobal()
          }}
          className="absolute top-4 left-4 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg border border-indigo-100 text-indigo-500 hover:bg-indigo-50 hover:scale-105 transition-all"
          title="返回全局视图"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Hints */}
      <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-full bg-white/80 border border-indigo-100 text-[10px] text-gray-400 font-bold shadow-sm pointer-events-none">
        滚轮缩放 · 拖拽平移
      </div>
      <div className="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-full bg-white/80 border border-indigo-100 text-[10px] text-gray-400 font-bold shadow-sm pointer-events-none">
        {Math.round(finalScale * 100)}%
      </div>

      {/* SVG with animated transform — transformOrigin is ALWAYS fixed at center */}
      <div
        className="w-full h-full"
        style={{
          transform: `translate(${finalPanX}px, ${finalPanY}px) scale(${finalScale})`,
          transformOrigin: '50% 50%',
          transition: isDragging
            ? 'none'
            : 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          {/* Background reference circles */}
          <circle cx={CX} cy={CY} r={ROOT_RADIUS} fill="none" stroke="#e0e7ff" strokeWidth="2" />
          <circle cx={CX} cy={CY} r={ROOT_RADIUS * 0.6} fill="none" stroke="#e0e7ff" strokeWidth="1" />

          {/* Lines: parent -> child */}
          {agents.map((agent) => {
            if (!agent.parent_id) return null
            const from = positions.get(agent.parent_id)
            const to = positions.get(agent.agent_id)
            if (!from || !to) return null
            const color = STANCE_COLORS[agent.stance] || '#94a3b8'
            const isSel = selectedAgent === agent.agent_id
            const isHov = hoveredAgent === agent.agent_id
            const opacity = isSel ? 0.7 : isHov ? 0.5 : 0.35
            const strokeWidth = isSel ? 4 : isHov ? 3 : 2

            return (
              <line
                key={`line-${agent.agent_id}`}
                x1={from[0]}
                y1={from[1]}
                x2={to[0]}
                y2={to[1]}
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={opacity}
                style={{ transition: 'all 0.3s', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredAgent(agent.agent_id)}
                onMouseLeave={() => setHoveredAgent(null)}
                onClick={() => handleAgentClick(agent.agent_id)}
              />
            )
          })}

          {/* Optional: root -> center lines (subtle) */}
          {agents
            .filter((a) => !a.parent_id)
            .map((agent) => {
              const pos = positions.get(agent.agent_id)
              if (!pos) return null
              const color = STANCE_COLORS[agent.stance] || '#94a3b8'
              const isSel = selectedAgent === agent.agent_id
              const isHov = hoveredAgent === agent.agent_id
              const opacity = isSel ? 0.4 : isHov ? 0.3 : 0.18
              const strokeWidth = isSel ? 3 : isHov ? 2 : 1.5

              return (
                <line
                  key={`root-line-${agent.agent_id}`}
                  x1={CX}
                  y1={CY}
                  x2={pos[0]}
                  y2={pos[1]}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  strokeDasharray="6 4"
                  style={{ transition: 'all 0.3s', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredAgent(agent.agent_id)}
                  onMouseLeave={() => setHoveredAgent(null)}
                  onClick={() => handleAgentClick(agent.agent_id)}
                />
              )
            })}

          {/* Center node */}
          <g
            onMouseEnter={() => setHoveredCenter(true)}
            onMouseLeave={() => setHoveredCenter(false)}
            onClick={handleCenterClick}
            style={{ cursor: isFocus ? 'pointer' : 'default' }}
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
              🌟
            </text>
            <text x={CX} y={CY + 18} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
              {centerLabel}
            </text>
          </g>

          {/* Agent nodes */}
          {agents.map((agent) => {
            const pos = positions.get(agent.agent_id)
            if (!pos) return null
            const color = STANCE_COLORS[agent.stance] || '#94a3b8'
            const isSel = selectedAgent === agent.agent_id
            const isHov = hoveredAgent === agent.agent_id
            const r = isSel ? 40 : isHov ? 34 : 28
            const hasChildren = (childrenMap.get(agent.agent_id)?.length ?? 0) > 0

            return (
              <g
                key={agent.agent_id}
                onMouseEnter={() => setHoveredAgent(agent.agent_id)}
                onMouseLeave={() => setHoveredAgent(null)}
                onClick={() => handleAgentClick(agent.agent_id)}
                style={{ cursor: 'pointer' }}
              >
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

                {/* Child count badge */}
                {hasChildren && (
                  <g>
                    <circle
                      cx={pos[0] + r * 0.7}
                      cy={pos[1] - r * 0.7}
                      r={10}
                      fill="white"
                      stroke={color}
                      strokeWidth={1.5}
                    />
                    <text
                      x={pos[0] + r * 0.7}
                      y={pos[1] - r * 0.7 + 3}
                      textAnchor="middle"
                      fontSize="9"
                      fill={color}
                      fontWeight="bold"
                    >
                      {childrenMap.get(agent.agent_id)!.length}
                    </text>
                  </g>
                )}

                <text
                  x={pos[0]}
                  y={pos[1] + 6}
                  textAnchor="middle"
                  fontSize={isSel ? '24' : '20'}
                >
                  {agent.stance === 'pro' ? '✅' : agent.stance === 'con' ? '❌' : '⚖️'}
                </text>

                {/* Expand button (visible on hover or selected) */}
                {(isHov || isSel) && onExpandAgent && (
                  <g
                    onClick={(e) => handleExpandClick(e as unknown as React.MouseEvent, agent.agent_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={pos[0] + r + 10}
                      cy={pos[1]}
                      r={12}
                      fill="white"
                      stroke={color}
                      strokeWidth={1.5}
                      opacity={0.95}
                    />
                    <text
                      x={pos[0] + r + 10}
                      y={pos[1] + 4}
                      textAnchor="middle"
                      fontSize="12"
                    >
                      🔍
                    </text>
                  </g>
                )}

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

      {/* Tooltips */}
      {hoveredAgent && (
        <AgentTooltip
          agent={agents.find((a) => a.agent_id === hoveredAgent)!}
          onMouseEnter={() => setHoveredAgent(hoveredAgent)}
          onMouseLeave={() => setHoveredAgent(null)}
        />
      )}
      {hoveredCenter && !hoveredAgent && (
        <CenterTooltip
          query={space?.query ?? '你的决策问题'}
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
  const isChild = !!agent.parent_id
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-4 py-3 rounded-2xl bg-white border-2 border-indigo-100 shadow-xl whitespace-nowrap">
        <div className="text-xs font-extrabold" style={{ color }}>
          {agent.stance === 'pro' ? '✅ 支持' : agent.stance === 'con' ? '❌ 反对' : '⚖️ 中立'}
          {isChild && <span className="ml-2 text-gray-400 font-normal">· 子节点</span>}
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
  query,
  onMouseEnter,
  onMouseLeave,
}: {
  query: string
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
        <div className="text-xs font-extrabold text-indigo-400">🌟 认知空间中心</div>
        <div className="text-xs text-gray-400 mt-0.5 max-w-[240px] truncate">{query}</div>
      </div>
    </div>
  )
}
