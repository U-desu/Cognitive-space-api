import { useMemo } from 'react'
import type { Agent } from '../api-types'

const ROOT_RADIUS = 45
const CHILD_RADIUS_BASE = 18

/** Deterministic hash from string to [0, 1] */
function hash01(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return (Math.abs(h) % 10000) / 10000
}

/** Deterministic random point inside sphere based on agent_id seed. */
function seededPointInSphere(seed: string, radius: number): [number, number, number] {
  // Use multiple hashes for x, y, z to avoid correlation
  const hx = hash01(seed + '_x')
  const hy = hash01(seed + '_y')
  const hz = hash01(seed + '_z')

  // Box-Muller-like approach for uniform sphere distribution
  // Convert uniform randoms to spherical coordinates
  const u = hx * 2 - 1  // -1 to 1 (cos(theta))
  const theta = hy * Math.PI * 2  // 0 to 2pi
  const r = Math.cbrt(hz) * radius  // cube root for uniform volume

  const sinTheta = Math.sqrt(1 - u * u)
  const x = r * sinTheta * Math.cos(theta)
  const y = r * u
  const z = r * sinTheta * Math.sin(theta)

  return [x, y, z]
}

/** Compute 3D positions for all agents. */
export function useLayout3D(agents: Agent[]): Map<string, [number, number, number]> {
  return useMemo(() => {
    const positions = new Map<string, [number, number, number]>()
    const childrenMap = new Map<string, Agent[]>()

    for (const agent of agents) {
      if (agent.parent_id) {
        const list = childrenMap.get(agent.parent_id) || []
        list.push(agent)
        childrenMap.set(agent.parent_id, list)
      }
    }

    // Place root nodes (no parent) uniformly inside the root sphere
    const roots = agents.filter((a) => !a.parent_id)
    for (const root of roots) {
      const pos = seededPointInSphere(root.agent_id, ROOT_RADIUS)
      positions.set(root.agent_id, pos)
    }

    // Recursively place children around their parent
    function placeChildren(parentId: string, depth: number) {
      const children = childrenMap.get(parentId)
      if (!children || children.length === 0) return

      const parentPos = positions.get(parentId)
      if (!parentPos) return

      const childRadius = CHILD_RADIUS_BASE * Math.pow(0.7, depth)

      for (const child of children) {
        // Offset from parent using seeded random
        const offset = seededPointInSphere(child.agent_id, childRadius)
        positions.set(child.agent_id, [
          parentPos[0] + offset[0],
          parentPos[1] + offset[1],
          parentPos[2] + offset[2],
        ])
        placeChildren(child.agent_id, depth + 1)
      }
    }

    for (const root of roots) {
      placeChildren(root.agent_id, 0)
    }

    // Fallback for any orphaned agents
    for (const agent of agents) {
      if (!positions.has(agent.agent_id)) {
        positions.set(agent.agent_id, seededPointInSphere(agent.agent_id, ROOT_RADIUS * 1.2))
      }
    }

    return positions
  }, [agents])
}

/** Build parent -> children map. */
export function useChildrenMap(agents: Agent[]): Map<string, Agent[]> {
  return useMemo(() => {
    const map = new Map<string, Agent[]>()
    for (const a of agents) {
      if (a.parent_id) {
        const list = map.get(a.parent_id) || []
        list.push(a)
        map.set(a.parent_id, list)
      }
    }
    return map
  }, [agents])
}
