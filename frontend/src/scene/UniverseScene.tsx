import { useState, Suspense, useMemo, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useSpaceState } from '../store/SpaceContext'
import { useLayout3D, useChildrenMap } from './useLayout3D'
import { AVATAR_IMAGES, USER_AGENT_ID } from '../constants'
import CameraRig from './CameraRig'
import CenterNode from './CenterNode'
import AgentNodes from './AgentNodes'
import ConnectionLines from './ConnectionLines'
import { useTheme } from '../theme/ThemeContext'
import type { Agent } from '../api-types'

interface Props {
  onAgentClick: (agentId: string) => void
  selectedAgent: string | null
  viewMode: 'global' | 'focus'
  onBackToGlobal: () => void
  onExpandAgent?: (agentId: string) => void
  resetCameraSignal?: number
  onResetCamera?: () => void
  debatingAgentIds?: string[]
  expandingAgentId?: string | null
}

export default function UniverseScene({
  onAgentClick,
  selectedAgent,
  viewMode,
  onBackToGlobal,
  onExpandAgent,
  resetCameraSignal,
  onResetCamera,
  debatingAgentIds = [],
  expandingAgentId,
}: Props) {
  const { state } = useSpaceState()
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const { theme: appTheme } = useTheme()

  const space = state.space
  const agents = space?.agents ?? []
  const isFocus = viewMode === 'focus'

  const positions = useLayout3D(agents)
  const childrenMap = useChildrenMap(agents)

  /** Which nodes glow when an agent is selected (itself + parent + children) */
  const highlightSet = useMemo(() => {
    const set = new Set<string>()
    if (!selectedAgent || selectedAgent === USER_AGENT_ID) return set

    set.add(selectedAgent)
    const selected = agents.find((a) => a.agent_id === selectedAgent)
    if (selected?.parent_id) set.add(selected.parent_id)
    const children = childrenMap.get(selectedAgent) || []
    for (const child of children) set.add(child.agent_id)
    return set
  }, [selectedAgent, agents, childrenMap])

  /** Which nodes should have a pulsing glow animation */
  const pulsingAgentIds = useMemo(() => {
    const set = new Set<string>()
    for (const id of debatingAgentIds) set.add(id)
    if (expandingAgentId) set.add(expandingAgentId)
    return set
  }, [debatingAgentIds, expandingAgentId])

  /** Camera distance ensures all nodes are visible: maxDist * 1.5, min 28 */
  const cameraDistance = useMemo(() => {
    let maxDist = 0
    for (const agent of agents) {
      const pos = positions.get(agent.agent_id)
      if (pos) maxDist = Math.max(maxDist, Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2))
    }
    return Math.max(28, maxDist * 1.5)
  }, [agents, positions])

  /** Camera focus target: selected agent position, or origin for center node */
  const targetPosition: [number, number, number] | null =
    selectedAgent && selectedAgent !== USER_AGENT_ID
      ? positions.get(selectedAgent) || null
      : selectedAgent === USER_AGENT_ID
      ? [0, 0, 0]
      : null

  /** Deterministic avatar assignment per agent_id */
  const agentAvatarMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const agent of agents) {
      const hash = agent.agent_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
      map.set(agent.agent_id, AVATAR_IMAGES[hash % AVATAR_IMAGES.length])
    }
    return map
  }, [agents])

  const centerLabel = space?.query
    ? space.query.length > 8
      ? space.query.slice(0, 8) + '…'
      : space.query
    : '问题'

  const isDark = true  /* all new themes are dark */

  return (
    <div className="w-full h-full relative bg-space-bg">
      {/* Back button (focus mode only) */}
      {isFocus && (
        <button
          onClick={onBackToGlobal}
          className={`absolute top-4 left-4 z-30 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur border transition-all hover:scale-105 ${
            'bg-white/10 border-white/20 text-white hover:bg-white/20'
          }`}
          title="返回全局视图"
        >
          ←
        </button>
      )}



      {/* Hints */}
      <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-full backdrop-blur border text-[10px] font-bold pointer-events-none bg-white/10 border-white/10 text-gray-300">
        拖拽旋转 · 滚轮缩放 · 双击空白返回
      </div>

      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.5, cameraDistance], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => gl.setClearColor(appTheme === 'cyberpunk' ? '#050508' : appTheme === 'deepspace' ? '#0a0f1e' : '#060f0a')}
      >
        <SceneBackground theme={appTheme} />

        <ambientLight intensity={0.4} />
        <pointLight position={[50, 50, 50]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-50, -30, -50]} intensity={0.5} color="#4a5568" />

        <Suspense fallback={null}>
          <Stars radius={150} depth={80} count={2000} factor={3} saturation={0} fade speed={0.5} />
        </Suspense>

        {/* Center sun node */}
        <CenterNode
          label={centerLabel}
          isDark={isDark}
          theme={appTheme}
          onClick={(e) => {
            e.stopPropagation()
            if (isFocus) onBackToGlobal()
            else onResetCamera?.()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHighlightedId(USER_AGENT_ID)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHighlightedId(null)
            document.body.style.cursor = 'auto'
          }}
        />

        {/* Agent nodes */}
        <AgentNodes
          agents={agents}
          positions={positions}
          childrenMap={childrenMap}
          selectedAgent={selectedAgent}
          hoveredAgent={hoveredAgent}
          highlightSet={highlightSet}
          pulsingAgentIds={pulsingAgentIds}
          agentAvatarMap={agentAvatarMap}
          darkBg={isDark}
          onAgentClick={onAgentClick}
          onExpandAgent={onExpandAgent}
          setHoveredAgent={setHoveredAgent}
          setHighlightedId={setHighlightedId}
        />

        {/* Parent-child & root-center lines */}
        <ConnectionLines
          agents={agents}
          positions={positions}
          selectedAgent={selectedAgent}
          hoveredAgent={hoveredAgent}
          highlightedId={highlightedId}
          isDark={isDark}
        />

        {/* Background click catcher — resets camera in global mode */}
        {!isFocus && onResetCamera && (
          <mesh
            onClick={(e) => {
              e.stopPropagation()
              onResetCamera()
            }}
          >
            <sphereGeometry args={[500, 32, 32]} />
            <meshBasicMaterial color={appTheme === 'cyberpunk' ? '#050508' : appTheme === 'deepspace' ? '#0a0f1e' : '#060f0a'} transparent opacity={0} side={THREE.BackSide} />
          </mesh>
        )}

        <CameraRig
          targetPosition={targetPosition}
          isFocus={isFocus}
          onBackToGlobal={onBackToGlobal}
          globalDistance={cameraDistance}
          resetCameraSignal={resetCameraSignal}
        />
      </Canvas>

      {/* Tooltip */}
      {hoveredAgent && <AgentTooltip agent={agents.find((a) => a.agent_id === hoveredAgent)!} theme={appTheme} />}
    </div>
  )
}

/** Simple tooltip shown when hovering an agent */
function AgentTooltip({ agent, theme }: { agent: Agent; theme: string }) {
  const accent = theme === 'cyberpunk' ? '#00f0ff' : theme === 'deepspace' ? '#3b82f6' : '#00ff88'
  const color = agent.stance === 'pro' ? accent : agent.stance === 'con' ? '#ff4444' : '#f59e0b'
  const isChild = !!agent.parent_id
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
      <div className="px-4 py-3 rounded-2xl bg-gray-900/90 border border-white/10 shadow-xl whitespace-nowrap backdrop-blur">
        <div className="text-xs font-extrabold" style={{ color }}>
          {agent.stance === 'pro' ? '✅ 支持' : agent.stance === 'con' ? '❌ 反对' : '⚖️ 中立'}
          {isChild && <span className="ml-2 text-gray-500 font-normal">· 子节点</span>}
        </div>
        <div className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">{agent.summary}</div>
        <div className="text-[10px] text-gray-500 font-mono mt-1">
          权威: {agent.position.authority.toFixed(2)} · 新颖: {agent.position.novelty.toFixed(2)}
        </div>
      </div>
    </div>
  )
}

/** Updates the renderer clear colour when the theme changes at runtime */
function SceneBackground({ theme }: { theme: string }) {
  const { gl } = useThree()
  const color = theme === 'cyberpunk' ? '#050508' : theme === 'deepspace' ? '#0a0f1e' : '#060f0a'
  useEffect(() => {
    gl.setClearColor(color)
  }, [gl, color])
  return null
}
