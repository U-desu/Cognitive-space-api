import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Agent } from '../api-types'

const STANCE_COLORS: Record<string, string> = {
  pro: '#4ade80',
  con: '#fb7185',
  neutral: '#fbbf24',
}

const STANCE_EMOJI: Record<string, string> = {
  pro: '✅',
  con: '❌',
  neutral: '⚖️',
}

interface NodeMeshProps {
  agent: Agent
  position: [number, number, number]
  isSelected: boolean
  isHovered: boolean
  hasChildren: boolean
  childCount: number
  darkBg?: boolean
  isNetworkHighlighted?: boolean
  onClick: () => void
  onPointerOver: () => void
  onPointerOut: () => void
  onExpand?: () => void
  avatarUrl?: string
}

export default function NodeMesh({
  agent,
  position,
  isSelected,
  isHovered,
  hasChildren,
  childCount,
  darkBg = false,
  isNetworkHighlighted = false,
  onClick,
  onPointerOver,
  onPointerOut,
  onExpand,
  avatarUrl,
}: NodeMeshProps) {
  const glowRef = useRef<THREE.Mesh>(null)
  const avatarGroupRef = useRef<THREE.Group>(null)
  const [scaleAnim, setScaleAnim] = useState(0)

  const color = STANCE_COLORS[agent.stance] || '#94a3b8'
  const isChild = !!agent.parent_id

  // Load avatar texture if provided
  const texture = avatarUrl ? useTexture(avatarUrl) : null
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace
  }

  // Entrance animation: scale from 0 to 1
  useFrame((_, delta) => {
    if (scaleAnim < 1) {
      setScaleAnim((s) => Math.min(1, s + delta * 3))
    }
  })

  const baseScale = isSelected ? 1.6 : isHovered ? 1.3 : 1.0
  const currentScale = baseScale * scaleAnim

  // Glow pulse for selected node
  const glowScale = isSelected ? 1.8 + Math.sin(Date.now() * 0.003) * 0.15 : 1.0

  // Billboard: rotate entire avatar group to face camera
  useFrame(({ camera }) => {
    if (avatarGroupRef.current) {
      avatarGroupRef.current.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group position={position} scale={currentScale}>
      {/* Avatar group — billboarded, contains circle bg + image + border */}
      {texture ? (
        <group ref={avatarGroupRef}>
          {/* Semi-transparent white circle background */}
          <mesh>
            <circleGeometry args={[2.2, 64]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.2}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Avatar image plane */}
          <mesh
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              onPointerOver()
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              onPointerOut()
              document.body.style.cursor = 'auto'
            }}
          >
            <planeGeometry args={[3.6, 2.8]} />
            <meshBasicMaterial
              map={texture}
              transparent
              alphaTest={0.1}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Stance-colored circular border ring */}
          <mesh>
            <ringGeometry args={[2.1, 2.25, 64]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={
                isNetworkHighlighted ? 0.95 : isSelected ? 0.75 : isHovered ? 0.55 : 0.3
              }
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ) : (
        /* Fallback sphere when no avatar */
        <mesh
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            onPointerOver()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            onPointerOut()
            document.body.style.cursor = 'auto'
          }}
        >
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={
              isNetworkHighlighted ? 1.0 : isSelected ? 0.6 : isHovered ? 0.4 : 0.2
            }
            roughness={0.3}
            metalness={0.1}
            transparent
            opacity={isChild ? 0.85 : 0.95}
          />
        </mesh>
      )}

      {/* Glow halo */}
      {(isSelected || isHovered) && (
        <mesh ref={glowRef} scale={glowScale}>
          <sphereGeometry args={[2.4, 32, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={isSelected ? 0.15 : 0.08}
          />
        </mesh>
      )}

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.8, 0.06, 16, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Child indicator ring — theme-aware for contrast */}
      {isChild && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.5, 0.08, 16, 64]} />
          <meshBasicMaterial color={darkBg ? '#e2e8f0' : '#1e293b'} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Child count badge */}
      {hasChildren && (
        <group position={[2.0, 1.4, 0]}>
          <mesh>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial color="white" />
          </mesh>
          <Text
            position={[0, 0, 0.3]}
            fontSize={0.6}
            color={color}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            {childCount}
          </Text>
        </group>
      )}

      {/* Expand button (visible on hover/selected) */}
      {(isHovered || isSelected) && onExpand && (
        <group
          position={[2.4, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            onExpand()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto'
          }}
        >
          <mesh>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshStandardMaterial color="white" emissive="#ffffff" emissiveIntensity={0.3} />
          </mesh>
          <Text position={[0, 0, 0.3]} fontSize={0.5} color="#333" anchorX="center" anchorY="middle">
            🔍
          </Text>
        </group>
      )}

      {/* Label — custom billboard: always faces camera */}
      <LabelGroup position={[0, -2.8, 0]}>
        <Text
          fontSize={1.0}
          color="#1a202c"
          anchorX="center"
          anchorY="top"
          outlineWidth={0.03}
          outlineColor="#ffffff"
        >
          {STANCE_EMOJI[agent.stance]} {agent.name}
        </Text>
      </LabelGroup>
    </group>
  )
}

/** Custom billboard component: uses lookAt(camera.position) every frame */
function LabelGroup({ children, position }: { children: React.ReactNode; position: [number, number, number] }) {
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
