import { useState, Suspense, useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useSpaceState } from '../store/SpaceContext'
import { useLayout3D, useChildrenMap } from './useLayout3D'
import NodeMesh from './NodeMesh'
import ConnectionLine from './ConnectionLine'
import ParticleTrail from './ParticleTrail'
import CameraRig from './CameraRig'
import BackgroundThemeSwitcher, { getSavedTheme } from '../components/BackgroundThemeSwitcher'
import type { Agent } from '../api-types'
import type { Theme } from '../components/BackgroundThemeSwitcher'

const STANCE_COLORS: Record<string, string> = {
  pro: '#4ade80',
  con: '#fb7185',
  neutral: '#fbbf24',
}

const CENTER_COLOR = '#818cf8'
const USER_AGENT_ID = '__user__'
const AGENT_CIRCLE_RADIUS = 2.2
const CENTER_CIRCLE_RADIUS = 2.5

function offsetTowards(
  point: [number, number, number],
  target: [number, number, number],
  distance: number
): [number, number, number] {
  const dx = target[0] - point[0]
  const dy = target[1] - point[1]
  const dz = target[2] - point[2]
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (len === 0) return point
  const t = distance / len
  return [point[0] + dx * t, point[1] + dy * t, point[2] + dz * t]
}

interface Props {
  onAgentClick: (agentId: string) => void
  selectedAgent: string | null
  viewMode: 'global' | 'focus'
  onBackToGlobal: () => void
  onExpandAgent?: (agentId: string) => void
  resetCameraSignal?: number
  onResetCamera?: () => void
}

export default function UniverseScene({
  onAgentClick,
  selectedAgent,
  viewMode,
  onBackToGlobal,
  onExpandAgent,
  resetCameraSignal,
  onResetCamera,
}: Props) {
  const { state } = useSpaceState()
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(getSavedTheme)

  const space = state.space
  const agents = space?.agents ?? []
  const isFocus = viewMode === 'focus'

  const positions = useLayout3D(agents)
  const childrenMap = useChildrenMap(agents)

  // Compute which nodes should glow when an agent is SELECTED.
  // Hover no longer highlights nodes — only edges.
  const highlightSet = useMemo(() => {
    const set = new Set<string>()

    if (!selectedAgent || selectedAgent === USER_AGENT_ID) return set

    // Highlight the selected agent itself
    set.add(selectedAgent)

    // Highlight its parent
    const selected = agents.find((a) => a.agent_id === selectedAgent)
    if (selected?.parent_id) {
      set.add(selected.parent_id)
    }

    // Highlight all its children
    const children = childrenMap.get(selectedAgent) || []
    for (const child of children) {
      set.add(child.agent_id)
    }

    return set
  }, [selectedAgent, agents, childrenMap])

  // Dynamic camera distance based on node bounding sphere
  const cameraDistance = useMemo(() => {
    let maxDist = 0
    for (const agent of agents) {
      const pos = positions.get(agent.agent_id)
      if (pos) {
        const dist = Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2)
        maxDist = Math.max(maxDist, dist)
      }
    }
    // Ensure all nodes are visible: distance = maxDist * 1.8
    // Minimum 35 to avoid being too close when few nodes
    return Math.max(35, maxDist * 1.8)
  }, [agents, positions])

  // Target position for camera focus
  const targetPosition: [number, number, number] | null =
    selectedAgent && selectedAgent !== USER_AGENT_ID
      ? positions.get(selectedAgent) || null
      : selectedAgent === USER_AGENT_ID
      ? [0, 0, 0]
      : null

  // Center label
  // Avatar images for agents
  const AVATAR_IMAGES = useMemo(
    () => [
      '/avatars/极客赌徒.png',
      '/avatars/稳健派VP.png',
      '/avatars/焦虑中干.png',
      '/avatars/海归博士.png',
      '/avatars/财务自由者.png',
      '/avatars/外包老兵.png',
      '/avatars/转型顾问.png',
      '/avatars/赛道投资人.png',
      '/avatars/体制内观察员.png',
      '/avatars/佛系产品经理.png',
      '/avatars/草根逆袭者.png',
      '/avatars/大厂HRD.png',
      '/avatars/全栈工程师.png',
      '/avatars/护城河构建者.png',
      '/avatars/趋势洞察者.png',
      '/avatars/AI布道者.png',
      '/avatars/技术写作者.png',
      '/avatars/地缘政治分析师.png',
      '/avatars/增长黑客.png',
      '/avatars/商务拓展.png',
      '/avatars/基础科学研究者.png',
      '/avatars/全球化运营.png',
      '/avatars/安全极客.png',
      '/avatars/运维工程师.png',
      '/avatars/技术天花板.png',
      '/avatars/管理教父.png',
      '/avatars/斜杠青年.png',
      '/avatars/焦虑螺丝钉.png',
      '/avatars/职场老油条.png',
      '/avatars/创业预备役.png',
      '/avatars/女性CTO.png',
      '/avatars/海归高管.png',
      '/avatars/技术布道者.png',
      '/avatars/健康至上者.png',
      '/avatars/天才少年.png',
      '/avatars/跨界艺术家.png',
    ],
    []
  )

  // Deterministic avatar assignment per agent_id
  const agentAvatarMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const agent of agents) {
      const hash = agent.agent_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
      map.set(agent.agent_id, AVATAR_IMAGES[hash % AVATAR_IMAGES.length])
    }
    return map
  }, [agents, AVATAR_IMAGES])

  const centerLabel = space?.query
    ? space.query.length > 8
      ? space.query.slice(0, 8) + '…'
      : space.query
    : '问题'

  const isDark = theme.style === 'dark'

  return (
    <div className="w-full h-full relative" style={{ background: theme.color }}>
      {/* Back button (focus mode only) */}
      {isFocus && (
        <button
          onClick={onBackToGlobal}
          className={`absolute top-4 left-4 z-30 flex items-center justify-center w-10 h-10 rounded-full backdrop-blur border transition-all hover:scale-105 ${
            isDark
              ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              : 'bg-black/10 border-black/20 text-gray-800 hover:bg-black/20'
          }`}
          title="返回全局视图"
        >
          ←
        </button>
      )}

      <BackgroundThemeSwitcher currentTheme={theme} onThemeChange={setTheme} />

      {/* Hints */}
      <div className={`absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-full backdrop-blur border text-[10px] font-bold pointer-events-none ${
        isDark
          ? 'bg-white/10 border-white/10 text-gray-300'
          : 'bg-black/10 border-black/10 text-gray-600'
      }`}>
        拖拽旋转 · 滚轮缩放 · 双击空白返回
      </div>

      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.5, cameraDistance], fov: 60, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(theme.color)
        }}
      >
        <SceneBackground color={theme.color} />

        <ambientLight intensity={0.4} />
        <pointLight position={[50, 50, 50]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-50, -30, -50]} intensity={0.5} color="#4a5568" />

        <Suspense fallback={null}>
          <Stars radius={150} depth={80} count={2000} factor={3} saturation={0} fade speed={0.5} />
        </Suspense>

        {/* Center node — click to reset focus */}
        <group
          position={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            if (isFocus) {
              onBackToGlobal()
            } else {
              onResetCamera?.()
            }
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
        >
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
          <CenterLabel position={[0, -4.5, 0]}>
            <Text
              fontSize={2.5}
              color="#1a202c"
              anchorX="center"
              anchorY="top"
              outlineWidth={0.05}
              outlineColor="#ffffff"
            >
              🌟 {centerLabel}
            </Text>
          </CenterLabel>
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
              darkBg={isDark}
              isNetworkHighlighted={highlightSet.has(agent.agent_id)}
              onClick={() => onAgentClick(agent.agent_id)}
              onPointerOver={() => {
                setHoveredAgent(agent.agent_id)
                setHighlightedId(agent.agent_id)
              }}
              onPointerOut={() => {
                setHoveredAgent(null)
                setHighlightedId(null)
              }}
              onExpand={onExpandAgent ? () => onExpandAgent(agent.agent_id) : undefined}
              avatarUrl={agentAvatarMap.get(agent.agent_id)}
            />
          )
        })}

        {/* Parent -> child lines — dashed, theme-aware color for contrast */}
        {agents.map((agent) => {
          if (!agent.parent_id) return null
          const rawFrom = positions.get(agent.parent_id)
          const rawTo = positions.get(agent.agent_id)
          if (!rawFrom || !rawTo) return null
          const isSel = selectedAgent === agent.agent_id
          const isHov = hoveredAgent === agent.agent_id
          const opacity = isSel ? 0.9 : isHov ? 0.75 : 0.6
          // High contrast against current background
          const lineColor = isDark ? '#e2e8f0' : '#1e293b'

          const isLineHighlighted =
            !selectedAgent &&
            (highlightedId === agent.agent_id || highlightedId === agent.parent_id)

          // Offset line endpoints to circle edges
          const from = offsetTowards(rawFrom, rawTo, AGENT_CIRCLE_RADIUS)
          const to = offsetTowards(rawTo, rawFrom, AGENT_CIRCLE_RADIUS)

          return (
            <group key={`line-group-${agent.agent_id}`}>
              <ConnectionLine
                from={from}
                to={to}
                color={lineColor}
                opacity={opacity}
                dashed
                dashScale={2.5}
                isNetworkHighlighted={isLineHighlighted}
              />
              <ParticleTrail
                from={from}
                to={to}
                active={isLineHighlighted}
              />
            </group>
          )
        })}

        {/* Root -> center lines — subtle stance-colored solid lines */}
        {agents
          .filter((a) => !a.parent_id)
          .map((agent) => {
            const rawPos = positions.get(agent.agent_id)
            if (!rawPos) return null
            const rootColor = STANCE_COLORS[agent.stance] || '#94a3b8'
            const isSel = selectedAgent === agent.agent_id
            const opacity = isSel ? 0.2 : 0.08

            const isRootLineHighlighted =
              !selectedAgent &&
              (highlightedId === agent.agent_id || highlightedId === USER_AGENT_ID)

            // Offset line endpoints to circle edges
            const from = offsetTowards([0, 0, 0], rawPos, CENTER_CIRCLE_RADIUS)
            const to = offsetTowards(rawPos, [0, 0, 0], AGENT_CIRCLE_RADIUS)

            return (
              <group key={`root-line-group-${agent.agent_id}`}>
                <ConnectionLine
                  from={from}
                  to={to}
                  color={rootColor}
                  opacity={opacity}
                  isNetworkHighlighted={isRootLineHighlighted}
                />
                <ParticleTrail
                  from={from}
                  to={to}
                  active={isRootLineHighlighted}
                />
              </group>
            )
          })}

        {/* Background click catcher — resets camera distance in global mode */}
        {!isFocus && onResetCamera && (
          <mesh
            onClick={(e) => {
              e.stopPropagation()
              onResetCamera()
            }}
          >
            <sphereGeometry args={[500, 32, 32]} />
            <meshBasicMaterial color={theme.color} transparent opacity={0} side={THREE.BackSide} />
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

/** Custom billboard for center label: always faces camera */
function CenterLabel({ children, position }: { children: React.ReactNode; position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(camera.quaternion)
    }
  })
  return (
    <group ref={groupRef} position={position}>
      {children}
    </group>
  )
}

/** Update canvas clear color when theme changes at runtime */
function SceneBackground({ color }: { color: string }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.setClearColor(color)
  }, [gl, color])
  return null
}
