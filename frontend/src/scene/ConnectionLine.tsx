import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

interface ConnectionLineProps {
  from: [number, number, number]
  to: [number, number, number]
  color: string
  opacity?: number
  dashed?: boolean
  dashScale?: number
  lineWidth?: number
  isNetworkHighlighted?: boolean
}

export default function ConnectionLine({
  from,
  to,
  color,
  opacity = 0.35,
  dashed = false,
  dashScale = 1,
  lineWidth = 1,
  isNetworkHighlighted = false,
}: ConnectionLineProps) {
  const lineRef = useRef<any>(null)

  const points = useMemo(
    () => [new THREE.Vector3(...from), new THREE.Vector3(...to)],
    [from, to]
  )

  useEffect(() => {
    if (dashed && lineRef.current) {
      lineRef.current.computeLineDistances()
    }
  }, [dashed, points])

  // Boost opacity when this line is part of the hovered network
  const finalOpacity = isNetworkHighlighted ? Math.min(1, opacity + 0.35) : opacity

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      {dashed ? (
        <lineDashedMaterial
          color={color}
          transparent
          opacity={finalOpacity}
          depthWrite={false}
          dashSize={0.8 * dashScale}
          gapSize={0.5 * dashScale}
          scale={1}
          linewidth={lineWidth}
        />
      ) : (
        <lineBasicMaterial
          color={color}
          transparent
          opacity={finalOpacity}
          depthWrite={false}
          linewidth={lineWidth}
        />
      )}
    </line>
  )
}
