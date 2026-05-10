import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'


interface CenterNodeProps {
  label: string
  isDark: boolean
  theme?: string
  onClick: (e: any) => void
  onPointerOver: (e: any) => void
  onPointerOut: () => void
}

/** Sun-like center sphere with subtle additive glow */
export default function CenterNode({ label, isDark, theme = 'cyberpunk', onClick, onPointerOver, onPointerOut }: CenterNodeProps) {
  const labelRef = useRef<THREE.Group>(null)

  useFrame(({ camera }) => {
    if (labelRef.current) {
      labelRef.current.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group
      position={[0, 0, 0]}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[3.0, 64, 64]} />
        <meshStandardMaterial
          color={theme === 'cyberpunk' ? '#00f0ff' : theme === 'deepspace' ? '#3b82f6' : '#00ff88'}
          emissive={theme === 'cyberpunk' ? '#00f0ff' : theme === 'deepspace' ? '#3b82f6' : '#00ff88'}
          emissiveIntensity={1.5}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Subtle additive glow shell */}
      <mesh>
        <sphereGeometry args={[4.0, 32, 32]} />
        <meshBasicMaterial
          color={theme === 'cyberpunk' ? '#b026ff' : theme === 'deepspace' ? '#8b5cf6' : '#00d4aa'}
          transparent
          opacity={0.1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight position={[0, 0, 0]} intensity={1.5} color={theme === 'cyberpunk' ? '#00f0ff' : theme === 'deepspace' ? '#3b82f6' : '#00ff88'} distance={60} decay={1.5} />

      {/* Billboard label below the sun */}
      <group ref={labelRef} position={[0, -5.0, 0]}>
        <Text
          fontSize={2.5}
          color={isDark ? '#ffffff' : '#1a202c'}
          anchorX="center"
          anchorY="top"
          outlineWidth={0.05}
          outlineColor={isDark ? '#000000' : '#ffffff'}
        >
          {theme === 'cyberpunk' ? '⚡' : theme === 'deepspace' ? '🌌' : '🧠'} {label}
        </Text>
      </group>
    </group>
  )
}
