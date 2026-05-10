import { useMemo } from 'react'
import type { Agent } from '../api-types'

/** Fixed root positions: octahedron vertices */
const ROOT_POSITIONS: [number, number, number][] = [
  [30, 0, 0],
  [-30, 0, 0],
  [0, 30, 0],
  [0, -30, 0],
  [0, 0, 30],
  [0, 0, -30],
]

const CHILD_RADIUS = 50
const GRANDCHILD_RADIUS = 65
const SPREAD = 0.28
const MIN_NODE_DISTANCE = 12

function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
  if (len === 0) return [0, 1, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

/** Get agent depth (0 = root, 1 = child, 2 = grandchild) */
function getDepth(agent: Agent, agents: Agent[]): number {
  let depth = 0
  let current = agent
  while (current.parent_id) {
    depth++
    const parent = agents.find((a) => a.agent_id === current.parent_id)
    if (!parent) break
    current = parent
  }
  return depth
}

/**
 * Generate child slots around a parent's direction.
 * Children are placed at `radius` along parent's direction,
 * then spread perpendicularly in a circle.
 */
function computeChildSlots(
  parentPos: [number, number, number],
  radius: number,
  count: number
): [number, number, number][] {
  const dir = normalize(parentPos)

  // Build local coordinate system: xAxis & yAxis perpendicular to dir
  const up: [number, number, number] = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const xAxis = normalize(cross(up, dir))
  const yAxis = cross(dir, xAxis)

  const offsetMag = radius * SPREAD
  const slots: [number, number, number][] = []

  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count
    const ox = Math.cos(angle) * offsetMag
    const oy = Math.sin(angle) * offsetMag

    slots.push([
      dir[0] * radius + xAxis[0] * ox + yAxis[0] * oy,
      dir[1] * radius + xAxis[1] * ox + yAxis[1] * oy,
      dir[2] * radius + xAxis[2] * ox + yAxis[2] * oy,
    ])
  }

  return slots
}

/** Enforce minimum distance from all occupied positions */
function enforceMinDistance(
  pos: [number, number, number],
  occupied: [number, number, number][]
): [number, number, number] {
  let result: [number, number, number] = [...pos]
  for (const other of occupied) {
    const d = distance(result, other)
    if (d < MIN_NODE_DISTANCE && d > 0) {
      const scale = MIN_NODE_DISTANCE / d
      result = [
        result[0] + (result[0] - other[0]) * (scale - 1) * 0.5,
        result[1] + (result[1] - other[1]) * (scale - 1) * 0.5,
        result[2] + (result[2] - other[2]) * (scale - 1) * 0.5,
      ]
    }
  }
  return result
}

/** Compute 3D positions: roots on octahedron, children in parent-direction cones */
export function useLayout3D(agents: Agent[]): Map<string, [number, number, number]> {
  return useMemo(() => {
    const positions = new Map<string, [number, number, number]>()

    // Group by depth
    const byDepth: Agent[][] = [[], [], []]
    for (const agent of agents) {
      const depth = getDepth(agent, agents)
      byDepth[Math.min(depth, 2)].push(agent)
    }

    const occupied: [number, number, number][] = []

    // --- Layer 0: roots on octahedron vertices ---
    const roots = byDepth[0]
    // Sort roots by agent_id for deterministic assignment
    roots.sort((a, b) => a.agent_id.localeCompare(b.agent_id))
    for (let i = 0; i < roots.length; i++) {
      const pos = ROOT_POSITIONS[i % ROOT_POSITIONS.length]
      positions.set(roots[i].agent_id, pos)
      occupied.push(pos)
    }

    // --- Layer 1: children around each root's direction ---
    // Group children by parent
    const childrenByParent = new Map<string, Agent[]>()
    for (const child of byDepth[1]) {
      const pid = child.parent_id || ''
      const list = childrenByParent.get(pid) || []
      list.push(child)
      childrenByParent.set(pid, list)
    }

    for (const [parentId, children] of childrenByParent) {
      const parentPos = positions.get(parentId)
      if (!parentPos) continue

      const slots = computeChildSlots(parentPos, CHILD_RADIUS, children.length)
      for (let i = 0; i < children.length; i++) {
        const pos = enforceMinDistance(slots[i], occupied)
        positions.set(children[i].agent_id, pos)
        occupied.push(pos)
      }
    }

    // --- Layer 2: grandchildren around each child's direction ---
    const grandchildrenByParent = new Map<string, Agent[]>()
    for (const gc of byDepth[2]) {
      const pid = gc.parent_id || ''
      const list = grandchildrenByParent.get(pid) || []
      list.push(gc)
      grandchildrenByParent.set(pid, list)
    }

    for (const [parentId, grandchildren] of grandchildrenByParent) {
      const parentPos = positions.get(parentId)
      if (!parentPos) continue

      const slots = computeChildSlots(parentPos, GRANDCHILD_RADIUS, grandchildren.length)
      for (let i = 0; i < grandchildren.length; i++) {
        const pos = enforceMinDistance(slots[i], occupied)
        positions.set(grandchildren[i].agent_id, pos)
        occupied.push(pos)
      }
    }

    // Fallback for any orphaned agents beyond layer 2
    for (const agent of agents) {
      if (!positions.has(agent.agent_id)) {
        const parentPos = agent.parent_id ? positions.get(agent.parent_id) : undefined
        const anchor = parentPos || [0, 0, 30]
        const fallback = computeChildSlots(anchor, GRANDCHILD_RADIUS + 15, 1)[0]
        const pos = enforceMinDistance(fallback, occupied)
        positions.set(agent.agent_id, pos)
        occupied.push(pos)
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
