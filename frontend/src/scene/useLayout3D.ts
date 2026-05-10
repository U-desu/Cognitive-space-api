import { useMemo } from 'react'
import type { Agent } from '../api-types'

/** Layer configuration: [radius, slotCount] for each depth */
const LAYER_CONFIG: { radius: number; slotCount: number }[] = [
  { radius: 30, slotCount: 6 },   // depth 0: root agents (up to 6)
  { radius: 50, slotCount: 18 },  // depth 1: children (up to 3 per root)
  { radius: 65, slotCount: 36 },  // depth 2: grandchildren (up to 2 per child)
]

const MIN_NODE_DISTANCE = 14

/** Precomputed Fibonacci sphere slots for each layer */
const LAYER_SLOTS: [number, number, number][][] = LAYER_CONFIG.map((cfg) =>
  fibonacciSphereSlots(cfg.radius, cfg.slotCount)
)

/** Generate evenly distributed points on a sphere using golden angle spiral */
function fibonacciSphereSlots(radius: number, count: number): [number, number, number][] {
  const points: [number, number, number][] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = goldenAngle * i
    points.push([
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius,
    ])
  }
  return points
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

/** Assign the best available slot for a node at given depth around its parent */
function assignSlot(
  depth: number,
  parentPos: [number, number, number],
  occupied: [number, number, number][]
): [number, number, number] {
  const layerIdx = Math.min(depth, LAYER_CONFIG.length - 1)
  const slots = LAYER_SLOTS[layerIdx]

  // Find all unoccupied slots
  const usedSet = new Set<number>()
  for (const pos of occupied) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < slots.length; i++) {
      const d = distance(pos, slots[i])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx >= 0 && bestDist < 8) {
      usedSet.add(bestIdx)
    }
  }

  const available = slots.map((slot, idx) => ({ slot, idx })).filter((s) => !usedSet.has(s.idx))

  if (available.length === 0) {
    // Fallback: place near parent if no slots left
    return fallbackNearParent(parentPos, layerIdx)
  }

  // Score each available slot
  const scored = available.map(({ slot }) => {
    const toParent = distance(slot, parentPos)
    let toOthers = Infinity
    for (const other of occupied) {
      toOthers = Math.min(toOthers, distance(slot, other))
    }
    // Prefer far from others, but not too far from parent
    const score = toOthers - toParent * 0.3
    return { slot, score }
  })

  scored.sort((a, b) => b.score - a.score)
  let chosen = scored[0].slot

  // Enforce minimum distance by nudging away if needed
  for (const other of occupied) {
    const d = distance(chosen, other)
    if (d < MIN_NODE_DISTANCE && d > 0) {
      const scale = MIN_NODE_DISTANCE / d
      chosen = [
        chosen[0] + (chosen[0] - other[0]) * (scale - 1) * 0.5,
        chosen[1] + (chosen[1] - other[1]) * (scale - 1) * 0.5,
        chosen[2] + (chosen[2] - other[2]) * (scale - 1) * 0.5,
      ]
    }
  }

  return chosen
}

/** Fallback placement when all slots are taken */
function fallbackNearParent(
  parentPos: [number, number, number],
  layerIdx: number
): [number, number, number] {
  const radius = LAYER_CONFIG[layerIdx].radius
  // Place at a fixed offset from parent, on the sphere surface
  const dir = [parentPos[0], parentPos[1] + radius * 0.3, parentPos[2] + radius * 0.2]
  const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2)
  if (len === 0) return [0, radius, 0]
  const scale = radius / len
  return [dir[0] * scale, dir[1] * scale, dir[2] * scale]
}

/** Compute 3D positions for all agents using layered sphere slots */
export function useLayout3D(agents: Agent[]): Map<string, [number, number, number]> {
  return useMemo(() => {
    const positions = new Map<string, [number, number, number]>()

    // Group agents by depth
    const byDepth: Agent[][] = [[], [], []]
    for (const agent of agents) {
      const depth = getDepth(agent, agents)
      const idx = Math.min(depth, 2)
      byDepth[idx].push(agent)
    }

    // Place layer 0 (roots) — center is origin
    const occupied: [number, number, number][] = []
    for (const root of byDepth[0]) {
      const pos = assignSlot(0, [0, 0, 0], occupied)
      positions.set(root.agent_id, pos)
      occupied.push(pos)
    }

    // Place layer 1 (children)
    for (const child of byDepth[1]) {
      const parentPos = child.parent_id ? positions.get(child.parent_id) : undefined
      const anchor = parentPos || [0, 0, 0]
      const pos = assignSlot(1, anchor, occupied)
      positions.set(child.agent_id, pos)
      occupied.push(pos)
    }

    // Place layer 2 (grandchildren)
    for (const grandchild of byDepth[2]) {
      const parentPos = grandchild.parent_id ? positions.get(grandchild.parent_id) : undefined
      const anchor = parentPos || [0, 0, 0]
      const pos = assignSlot(2, anchor, occupied)
      positions.set(grandchild.agent_id, pos)
      occupied.push(pos)
    }

    // Fallback for any orphaned agents beyond layer 2
    for (const agent of agents) {
      if (!positions.has(agent.agent_id)) {
        const depth = getDepth(agent, agents)
        const parentPos = agent.parent_id ? positions.get(agent.parent_id) : undefined
        const anchor = parentPos || [0, 0, 0]
        const pos = assignSlot(depth, anchor, occupied)
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
