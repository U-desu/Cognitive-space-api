import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface CameraRigProps {
  targetPosition: [number, number, number] | null
  isFocus: boolean
  onBackToGlobal?: () => void
  globalDistance?: number
  resetCameraSignal?: number
}

export default function CameraRig({ targetPosition, isFocus, onBackToGlobal, globalDistance = 80, resetCameraSignal }: CameraRigProps) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  // Animation state — only active during a transition
  const isAnimating = useRef(false)
  const animProgress = useRef(0)
  const startPos = useRef(new THREE.Vector3())
  const startTarget = useRef(new THREE.Vector3())
  const startAzimuth = useRef(0)
  const startPolar = useRef(0)

  // When target changes, start a one-shot fly animation
  useEffect(() => {
    if (!controlsRef.current) return

    isAnimating.current = true
    animProgress.current = 0
    startPos.current.copy(camera.position)
    startTarget.current.copy(controlsRef.current.target)
    startAzimuth.current = controlsRef.current.getAzimuthalAngle()
    startPolar.current = controlsRef.current.getPolarAngle()
  }, [targetPosition, isFocus, resetCameraSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Fly animation — runs every frame while isAnimating is true.
   *
   * Algorithm:
   * 1. Capture startPos / startTarget / startAzimuth / startPolar when target
   *    changes (useEffect above).
   * 2. Advance animProgress each frame (~0.4 s total at delta*2.5).
   * 3. Keep the user's original azimuth & polar angles, only change distance.
   * 4. Convert spherical (azimuth, polar, distance) → Cartesian offset.
   * 5. desiredCamPos = targetVec + offset  → camera orbits the target.
   * 6. easeOutCubic interpolation for smooth deceleration at the end.
   * 7. Stop animating at progress >= 1.0, hand back to OrbitControls.
   *
   * Focus-mode sidebar offset:
   *    Shift target toward camera-right by 10 world units so the selected
   *    node sits in the centre of the remaining viewport (excluding the
   *    right-hand AgentPanel).
   */
  useFrame((_, delta) => {
    if (!isAnimating.current || !controlsRef.current) return

    animProgress.current = Math.min(1, animProgress.current + delta * 2.5)
    const t = easeOutCubic(animProgress.current)

    const targetVec = targetPosition
      ? new THREE.Vector3(...targetPosition)
      : new THREE.Vector3(0, 0, 0)

    // In focus mode, shift target toward screen-right so the node lands
    // in the center of the remaining space (screen width minus sidebar).
    if (targetPosition && isFocus) {
      const viewDir = new THREE.Vector3().subVectors(camera.position, targetVec).normalize()
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), viewDir).normalize()
      targetVec.add(right.multiplyScalar(10))
    }

    // Preserve the user's current viewing angles (azimuth + polar)
    // Only change the distance (radius) and the target position
    const focusDistance = 38
    const desiredDistance = targetPosition ? focusDistance : globalDistance

    const azimuth = startAzimuth.current
    const polar = startPolar.current

    // Spherical to Cartesian: maintain angle, change radius
    const offset = new THREE.Vector3()
    offset.x = desiredDistance * Math.sin(polar) * Math.sin(azimuth)
    offset.y = desiredDistance * Math.cos(polar)
    offset.z = desiredDistance * Math.sin(polar) * Math.cos(azimuth)

    const desiredCamPos = targetVec.clone().add(offset)

    // Lerp camera position
    camera.position.lerpVectors(startPos.current, desiredCamPos, t)

    // Lerp controls target
    const currentTarget = new THREE.Vector3().lerpVectors(startTarget.current, targetVec, t)
    controlsRef.current.target.copy(currentTarget)
    controlsRef.current.update()

    // Animation finished — stop interfering with OrbitControls
    if (animProgress.current >= 1) {
      isAnimating.current = false
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={10}
      maxDistance={200}
      onDoubleClick={() => {
        if (isFocus && onBackToGlobal) {
          onBackToGlobal()
        }
      }}
    />
  )
}

/** Ease-out cubic for smooth camera fly */
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}
