import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { STANCE_EMOJI } from '../constants'
import type { Agent } from '../api-types'

interface NodeLabelProps {
  agent: Agent
  darkBg: boolean
  position?: [number, number, number]
}

/**
 * Billboard label that always faces the camera.
 * Renders the agent name with an emoji prefix and an outline for readability.
 */
export default function NodeLabel({ agent, darkBg, position = [0, -3.2, 0] }: NodeLabelProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ camera }) => {
    if (groupRef.current) {
      groupRef.current.quaternion.copy(camera.quaternion)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <Text
        fontSize={1.15}
        color={darkBg ? '#ffffff' : '#1a202c'}
        anchorX="center"
        anchorY="top"
        outlineWidth={0.03}
        outlineColor={darkBg ? '#000000' : '#ffffff'}
      >
        {STANCE_EMOJI[agent.stance]} {agent.name}
      </Text>
    </group>
  )
}
