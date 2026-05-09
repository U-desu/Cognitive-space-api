import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface CameraRigProps {
  targetPosition: [number, number, number] | null
  isFocus: boolean
  onBackToGlobal?: () => void
}

export default function CameraRig({ targetPosition, isFocus, onBackToGlobal }: CameraRigProps) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  // Animation state — only active during a transition
  const isAnimating = useRef(false)
  const animProgress = useRef(0)
  const startPos = useRef(new THREE.Vector3())
  const startTarget = useRef(new THREE.Vector3())

  // When target changes, start a one-shot fly animation
  useEffect(() => {
    if (!controlsRef.current) return

    isAnimating.current = true
    animProgress.current = 0
    startPos.current.copy(camera.position)
    startTarget.current.copy(controlsRef.current.target)
  }, [targetPosition, isFocus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Execute the fly animation; once complete, hands control back to OrbitControls
  useFrame((_, delta) => {
    if (!isAnimating.current || !controlsRef.current) return

    animProgress.current = Math.min(1, animProgress.current + delta * 2.5)
    const t = easeOutCubic(animProgress.current)

    const targetVec = targetPosition
      ? new THREE.Vector3(...targetPosition)
      : new THREE.Vector3(0, 0, 0)

    const desiredCamPos = targetPosition
      ? targetVec.clone().add(new THREE.Vector3(15, 10, 15))
      : new THREE.Vector3(80, 40, 80)

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
