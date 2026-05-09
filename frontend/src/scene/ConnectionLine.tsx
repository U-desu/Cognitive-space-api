import { useMemo } from 'react'
import * as THREE from 'three'

interface ConnectionLineProps {
  from: [number, number, number]
  to: [number, number, number]
  color: string
  opacity?: number
  dashed?: boolean
// eslint-disable-next-line @typescript-eslint/no-unused-vars
}

export default function ConnectionLine({
  from,
  to,
  color,
  opacity = 0.35,
  // dashed is reserved for future use
}: ConnectionLineProps) {
  const points = useMemo(
    () => [new THREE.Vector3(...from), new THREE.Vector3(...to)],
    [from, to]
  )

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </line>
  )
}
