import { useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars, Text } from '@react-three/drei'
import { useSpaceState } from '../store/SpaceContext'
import { useLayout3D, useChildrenMap } from './useLayout3D'
import NodeMesh from './NodeMesh'
import ConnectionLine from './ConnectionLine'
import CameraRig from './CameraRig'
import type { Agent } from '../api-types'

const STANCE_COLORS: Record<string, string> = {
  pro: '#4ade80',
  con: '#fb7185',
  neutral: '#fbbf24',
}

const CENTER_COLOR = '#818cf8'
const USER_AGENT_ID = '__user__'

interface Props {
  onAgentClick: (agentId: string) => void
  selectedAgent: string | null
  viewMode: 'global' | 'focus'
  onBackToGlobal: () => void
  onExpandAgent?: (agentId: string) => void
}

export default function UniverseScene({
  onAgentClick,
  selectedAgent,
  viewMode,
  onBackToGlobal,
  onExpandAgent,
}: Props) {
  const { state } = useSpaceState()
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)

  const space = state.space
  const agents = space?.agents ?? []
  const isFocus = viewMode === 'focus'

  const positions = useLayout3D(agents)
  const childrenMap = useChildrenMap(agents)

  // Target position for camera focus
  const targetPosition: [number, number, number] | null =
    selectedAgent && selectedAgent !== USER_AGENT_ID
      ? positions.get(selectedAgent) || null
      : selectedAgent === USER_AGENT_ID
      ? [0, 0, 0]
      : null

  // Center label
  const centerLabel = space?.query
    ? space.query.length > 8
      ? space.query.slice(0, 8) + '…'
      : space.query
    : '问题'

  return (
    <div className="w-full h-full relative" style={{ background: '#080816' }}>
      {/* Back button (focus mode only) */}
      {isFocus && (
        <button
          onClick={onBackToGlobal}
          className="absolute top-4 left-4 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all"
          title="返回全局视图"
        >
          ←
        </button>
      )}

      {/* Hints */}
      <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/10 text-[10px] text-gray-400 font-bold pointer-events-none">
        拖拽旋转 · 滚轮缩放 · 双击空白返回
      </div>

      <Canvas
        camera={{ position: [80, 40, 80], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#080816')
        }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[50, 50, 50]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-50, -30, -50]} intensity={0.5} color="#4a5568" />

        <Suspense fallback={null}>
          <Stars radius={150} depth={80} count={2000} factor={3} saturation={0} fade speed={0.5} />
        </Suspense>

        {/* Center node */}
        <group position={[0, 0, 0]}>
          <mesh>
            <sphereGeometry args={[2.5, 32, 32]} />
            <meshStandardMaterial
              color={CENTER_COLOR}
              emissive={CENTER_COLOR}
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh scale={1.3}>
            <sphereGeometry args={[2.5, 32, 32]} />
            <meshBasicMaterial color={CENTER_COLOR} transparent opacity={0.15} />
          </mesh>
          <Text
            position={[0, -4.5, 0]}
            fontSize={2.5}
            color="white"
            anchorX="center"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#000000"
          >
            🌟 {centerLabel}
          </Text>
        </group>

        {/* Agent nodes */}
        {agents.map((agent) => {
          const pos = positions.get(agent.agent_id)
          if (!pos) return null
          const isSel = selectedAgent === agent.agent_id
          const isHov = hoveredAgent === agent.agent_id
          const childList = childrenMap.get(agent.agent_id) || []

          return (
            <NodeMesh
              key={agent.agent_id}
              agent={agent}
              position={pos}
              isSelected={isSel}
              isHovered={isHov}
              hasChildren={childList.length > 0}
              childCount={childList.length}
              onClick={() => onAgentClick(agent.agent_id)}
              onPointerOver={() => setHoveredAgent(agent.agent_id)}
              onPointerOut={() => setHoveredAgent(null)}
              onExpand={onExpandAgent ? () => onExpandAgent(agent.agent_id) : undefined}
            />
          )
        })}

        {/* Parent -> child lines */}
        {agents.map((agent) => {
          if (!agent.parent_id) return null
          const from = positions.get(agent.parent_id)
          const to = positions.get(agent.agent_id)
          if (!from || !to) return null
          const color = STANCE_COLORS[agent.stance] || '#94a3b8'
          const isSel = selectedAgent === agent.agent_id
          const opacity = isSel ? 0.6 : 0.25

          return (
            <ConnectionLine
              key={`line-${agent.agent_id}`}
              from={from}
              to={to}
              color={color}
              opacity={opacity}
            />
          )
        })}

        {/* Optional: root -> center dashed lines (subtle) */}
        {agents
          .filter((a) => !a.parent_id)
          .map((agent) => {
            const pos = positions.get(agent.agent_id)
            if (!pos) return null
            const rootColor = STANCE_COLORS[agent.stance] || '#94a3b8'
            const isSel = selectedAgent === agent.agent_id
            const opacity = isSel ? 0.25 : 0.1

            return (
              <ConnectionLine
                key={`root-line-${agent.agent_id}`}
                from={[0, 0, 0]}
                to={pos}
                color={rootColor}
                opacity={opacity}
              />
            )
          })}

        <CameraRig
          targetPosition={targetPosition}
          isFocus={isFocus}
          onBackToGlobal={onBackToGlobal}
        />
      </Canvas>

      {/* Tooltip */}
      {hoveredAgent && (
        <AgentTooltip
          agent={agents.find((a) => a.agent_id === hoveredAgent)!}
        />
      )}
    </div>
  )
}

function AgentTooltip({ agent }: { agent: Agent }) {
  const color = STANCE_COLORS[agent.stance] || '#94a3b8'
  const isChild = !!agent.parent_id
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
      <div className="px-4 py-3 rounded-2xl bg-gray-900/90 border border-white/10 shadow-xl whitespace-nowrap backdrop-blur">
        <div className="text-xs font-extrabold" style={{ color }}>
          {agent.stance === 'pro' ? '✅ 支持' : agent.stance === 'con' ? '❌ 反对' : '⚖️ 中立'}
          {isChild && <span className="ml-2 text-gray-500 font-normal">· 子节点</span>}
        </div>
        <div className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">
          {agent.summary}
        </div>
        <div className="text-[10px] text-gray-500 font-mono mt-1">
          权威: {agent.position.authority.toFixed(2)} · 新颖: {agent.position.novelty.toFixed(2)}
        </div>
      </div>
    </div>
  )
}
