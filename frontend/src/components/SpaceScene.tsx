import { useState, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html, Line, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import type { Edge, Agent } from '../api-types'

const RADIUS = 2.5

const STANCE_COLORS: Record<string, string> = {
  pro: '#06b6d4',
  con: '#ef4444',
  neutral: '#f59e0b',
}

/** Fibonacci Sphere: evenly distribute N points on a sphere */
function fibonacciSphere(n: number, radius: number): [number, number, number][] {
  const points: [number, number, number][] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = goldenAngle * i
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    points.push([x * radius, y * radius, z * radius])
  }
  return points
}

interface AgentNodeProps {
  agent: Agent
  position: [number, number, number]
  isHovered: boolean
  onHover: (id: string | null) => void
  onClick: () => void
}

function AgentNode({ agent, position, isHovered, onHover, onClick }: AgentNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = STANCE_COLORS[agent.stance] || '#94a3b8'
  const size = 0.12 + (agent.confidence || 0.8) * 0.08

  useFrame(() => {
    if (meshRef.current) {
      const target = isHovered ? size * 1.4 : size
      meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.1)
    }
  })

  return (
    <group position={position}>
      <Sphere
        ref={meshRef}
        args={[size, 32, 32]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(agent.agent_id)
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.8 : 0.3}
          roughness={0.3}
          metalness={0.6}
        />
      </Sphere>
      <pointLight color={color} intensity={isHovered ? 2 : 0.8} distance={3} />

      {/* Name label always facing camera */}
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div
          className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
          style={{
            color: '#e2e8f0',
            backgroundColor: 'rgba(10,10,15,0.85)',
            border: `1px solid ${color}40`,
            textShadow: `0 0 8px ${color}60`,
          }}
        >
          {agent.name}
        </div>
      </Html>

      {/* Hover tooltip */}
      {isHovered && (
        <Html position={[0, size + 0.3, 0]} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-2 rounded-lg bg-space-surface border border-space-border shadow-xl whitespace-nowrap">
            <div className="text-xs font-bold" style={{ color }}>
              {agent.stance.toUpperCase()}
            </div>
            <div className="text-xs text-space-muted mt-0.5 max-w-[180px] truncate">
              {agent.summary}
            </div>
            <div className="text-[10px] text-space-muted font-mono mt-1">
              auth: {agent.position.authority.toFixed(2)} · nov: {agent.position.novelty.toFixed(2)}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

interface ConnectionLineProps {
  edge: Edge
  sourcePos: [number, number, number]
  targetPos: [number, number, number]
  sourceName: string
  targetName: string
  isHovered: boolean
  onHover: (id: string | null) => void
  onClick: () => void
}

function ConnectionLine({
  edge,
  sourcePos,
  targetPos,
  sourceName,
  targetName,
  isHovered,
  onHover,
  onClick,
}: ConnectionLineProps) {
  const isFundamental = edge.conflict_type === 'fundamental'
  const color = isFundamental ? '#d946ef' : '#06b6d4'
  const lineWidth = Math.max(1, edge.conflict_score * 5)
  const opacity = isHovered ? 1 : 0.3 + edge.conflict_score * 0.5

  const midPoint: [number, number, number] = [
    (sourcePos[0] + targetPos[0]) / 2,
    (sourcePos[1] + targetPos[1]) / 2,
    (sourcePos[2] + targetPos[2]) / 2,
  ]

  return (
    <group>
      <Line
        points={[sourcePos, targetPos]}
        color={color}
        lineWidth={lineWidth}
        opacity={opacity}
        transparent
        dashed={isFundamental}
        dashSize={0.08}
        gapSize={0.05}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(edge.edge_id)
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      />
      {isHovered && (
        <Html position={midPoint} style={{ pointerEvents: 'none' }}>
          <div className="px-3 py-2 rounded-lg bg-space-surface border border-space-border shadow-2xl whitespace-nowrap">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs text-space-cyan font-medium">{sourceName}</span>
              <span className="text-xs text-space-muted">↔</span>
              <span className="text-xs text-space-red font-medium">{targetName}</span>
            </div>
            <div className="text-sm font-mono font-bold text-space-magenta">
              冲突分数: {edge.conflict_score.toFixed(3)}
            </div>
            <div className="text-xs text-space-muted capitalize">
              {edge.conflict_type}
              {edge.debate_recommended && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-space-magenta/15 text-space-magenta text-[10px]">
                  建议辩论
                </span>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function ReferenceSphere() {
  return (
    <Sphere args={[RADIUS * 0.98, 64, 64]}>
      <meshBasicMaterial
        color="#06b6d4"
        wireframe
        transparent
        opacity={0.04}
      />
    </Sphere>
  )
}

function SceneContent({ onEdgeClick }: { onEdgeClick: (edgeId: string) => void }) {
  const { state, dispatch } = useSpaceState()
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)

  const space = state.space
  const edges = state.edges
  const agents = space?.agents ?? []

  const positions = useMemo(() => {
    return fibonacciSphere(agents.length, RADIUS)
  }, [agents.length])

  const agentPositions = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    agents.forEach((agent, i) => {
      map.set(agent.agent_id, positions[i])
    })
    return map
  }, [agents, positions])

  const visibleEdges = useMemo(() => {
    return edges.filter((e) => e.conflict_score > 0.25)
  }, [edges])

  async function handleEdgeClick(edgeId: string) {
    if (!space) return
    try {
      await api.createDebate(space.space_id, { edge_id: edgeId, format: 'structured', rounds: 2 })
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

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#06b6d4" />
      <Stars radius={50} depth={50} count={2000} factor={3} saturation={0} fade speed={1} />
      <ReferenceSphere />

      {/* Connection Lines */}
      {visibleEdges.map((edge) => {
        const sourcePos = agentPositions.get(edge.source)
        const targetPos = agentPositions.get(edge.target)
        if (!sourcePos || !targetPos) return null
        const source = agents.find((a) => a.agent_id === edge.source)
        const target = agents.find((a) => a.agent_id === edge.target)
        return (
          <ConnectionLine
            key={edge.edge_id}
            edge={edge}
            sourcePos={sourcePos}
            targetPos={targetPos}
            sourceName={source?.name ?? edge.source}
            targetName={target?.name ?? edge.target}
            isHovered={hoveredEdge === edge.edge_id}
            onHover={setHoveredEdge}
            onClick={() => handleEdgeClick(edge.edge_id)}
          />
        )
      })}

      {/* Agent Nodes */}
      {agents.map((agent, i) => (
        <AgentNode
          key={agent.agent_id}
          agent={agent}
          position={positions[i]}
          isHovered={hoveredAgent === agent.agent_id}
          onHover={setHoveredAgent}
          onClick={() => handleAgentClick(agent.agent_id)}
        />
      ))}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3}
        maxDistance={10}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  )
}

interface Props {
  onEdgeClick: (edgeId: string) => void
}

export default function SpaceScene({ onEdgeClick }: Props) {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        style={{ width: '100%', height: '100%', background: '#0a0a0f' }}
      >
        <SceneContent onEdgeClick={onEdgeClick} />
      </Canvas>
    </div>
  )
}
