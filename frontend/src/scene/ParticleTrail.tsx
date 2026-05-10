import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ParticleTrailProps {
  from: [number, number, number]
  to: [number, number, number]
  active: boolean
  particleCount?: number
  color?: string
}

/**
 * Vertex shader: drives particles along the line from uFrom → uTo.
 *
 * Key ideas:
 *  - aOffset (0..1) gives each particle a unique start position on the line.
 *  - uTime moves the particle forward; mod(…,1.0) makes it loop seamlessly.
 *  - mix(uFrom,uTo,t) is linear interpolation along the line.
 *  - sin(t*12.566) adds perpendicular jitter (12.566 = 4π, ~2 sine cycles).
 *  - smoothstep(0,0.15) * smoothstep(1,0.85) fades particles in at the start
 *    of the line and out at the end, avoiding abrupt pop-in / pop-out.
 *  - gl_PointSize shrinks with distance (280 / -z) so far particles stay tiny.
 */
const vertexShader = `
  attribute float aSize;
  attribute float aOffset;
  uniform float uTime;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform vec3 uJitterAxis;
  varying float vAlpha;

  void main() {
    float t = mod(aOffset + uTime * 0.4, 1.0);
    vec3 pos = mix(uFrom, uTo, t);

    // Perpendicular sine jitter for organic feel (4π ≈ 12.566)
    float jitter = sin(t * 12.566 + aOffset * 10.0) * 0.12;
    pos += uJitterAxis * jitter;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (280.0 / -mvPosition.z);

    // Fade in at start (0→0.15) and out at end (1→0.85)
    float edgeFade = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.85, t);
    vAlpha = edgeFade;
  }
`

/**
 * Fragment shader: renders each particle as a soft glowing circle.
 *
 *  - gl_PointCoord is (0,0) at top-left of the point sprite, (1,1) at bottom-right.
 *  - Centre is (0.5,0.5); dist > 0.5 discards pixels outside the circle.
 *  - smoothstep(0,0.5,dist) creates a soft radial falloff (solid centre,
 *    transparent edge) rather than a hard circle.
 *  - vAlpha (from vertex shader) applies the line-end fade and overall visibility.
 */
const fragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    // Soft radial falloff: solid at centre, transparent at edge
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    float alpha = glow * vAlpha * 0.95;

    gl_FragColor = vec4(uColor, alpha);
  }
`

export default function ParticleTrail({
  from,
  to,
  active,
  particleCount = 45,
  color = '#FFD700',
}: ParticleTrailProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const { positions, sizes, offsets } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    const sz = new Float32Array(particleCount)
    const off = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = 0
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = 0
      sz[i] = 0.4 + Math.random() * 0.9
      off[i] = Math.random()
    }

    return { positions: pos, sizes: sz, offsets: off }
  }, [particleCount])

  const fromVec = useMemo(() => new THREE.Vector3(...from), [from])
  const toVec = useMemo(() => new THREE.Vector3(...to), [to])
  const dir = useMemo(() => new THREE.Vector3().subVectors(toVec, fromVec), [toVec, fromVec])

  const jitterAxis = useMemo(() => {
    const axis = new THREE.Vector3(0, 1, 0)
    const dirNorm = dir.clone().normalize()
    if (Math.abs(dirNorm.dot(axis)) > 0.9) {
      axis.set(1, 0, 0)
    }
    axis.cross(dir).normalize()
    return axis
  }, [dir])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFrom: { value: fromVec },
      uTo: { value: toVec },
      uJitterAxis: { value: jitterAxis },
      uColor: { value: new THREE.Color(color) },
    }),
    [fromVec, toVec, jitterAxis, color]
  )

  useFrame(({ clock }) => {
    if (!active || !materialRef.current) return
    materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  if (!active) return null

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={particleCount}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aOffset"
          count={particleCount}
          array={offsets}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
