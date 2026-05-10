import { useMemo } from 'react'
import type { Agent } from '../api-types'
import { normalize, cross, distance, type Vec3 } from '../utils/vectors'
import { getDepth } from '../utils/agent-hierarchy'
import {
  ROOT_POSITIONS,
  CHILD_RADIUS,
  GRANDCHILD_RADIUS,
  LAYER_SPREAD,
  MIN_NODE_DISTANCE,
} from './layout-config'

/**
 * 3D hierarchical layout algorithm: octahedron roots + parent-direction cone offset.
 *
 * Design philosophy:
 * - Layer 0 (roots):    fixed on regular-octahedron vertices (6 slots, 90° apart)
 * - Layer 1 (children):  radius 50, scattered uniformly in a disc perpendicular
 *                        to the parent's direction (SPREAD = 0.28)
 * - Layer 2 (grandchildren): radius 65, same pattern
 *
 * Isolation guarantee:
 * - Neighbouring roots are 90° apart.
 * - Each root's children live inside a cone of half-angle arctan(0.28) ≈ 15.6°,
 *   so the full cone is ~31°.
 * - 31° × 2 = 62° < 90°, therefore cones from adjacent roots never overlap.
 * - Siblings under the same parent are distributed evenly around a circle in the
 *   plane perpendicular to the parent direction, so their mutual distance is
 *   roughly 2π·offset / count, always > MIN_NODE_DISTANCE for small counts.
 */

/**
 * Generate child-slot positions around a parent's direction.
 *
 * Steps:
 * 1. Normalise the parent's position → direction vector `dir`.
 * 2. Build a local coordinate system (xAxis, yAxis) perpendicular to `dir`.
 * 3. Place `count` points on a circle in that plane, radius = `radius * SPREAD`.
 * 4. Add the radial offset to the base position `dir * radius`.
 *
 * The result is a small "cone" of slots pointing outward from the parent.
 */
function computeChildSlots(
  parentPos: Vec3,
  radius: number,
  count: number
): Vec3[] {
  const dir = normalize(parentPos)

  // Pick an 'up' vector that is not parallel to dir
  const up: Vec3 = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const xAxis = normalize(cross(up, dir))
  const yAxis = cross(dir, xAxis) // already unit length because dir & xAxis are unit & orthogonal

  const offsetMag = radius * LAYER_SPREAD
  const slots: Vec3[] = []

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

/**
 * If `pos` is closer than MIN_NODE_DISTANCE to any already-occupied position,
 * nudge it away from the nearest offender(s) along the collision normal.
 */
function enforceMinDistance(pos: Vec3, occupied: Vec3[]): Vec3 {
  let result: Vec3 = [...pos]
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

/** Fallback placement for agents that exceed the expected 3-layer depth. */
function fallbackPosition(parentPos: Vec3): Vec3 {
  const fb = computeChildSlots(parentPos, GRANDCHILD_RADIUS + 15, 1)[0]
  return fb
}

/**
 * Compute 3D positions for all agents.
 *
 * Algorithm overview:
 * 1. Group agents by depth (0 = root, 1 = child, 2 = grandchild).
 * 2. Place roots on octahedron vertices (deterministic, sorted by agent_id).
 * 3. For each parent, generate child slots in a cone around the parent's
 *    direction and assign them to its children in order.
 * 4. After every assignment, enforce MIN_NODE_DISTANCE by nudging.
 * 5. Any agent deeper than layer 2 gets a fallback position.
 */
export function useLayout3D(agents: Agent[]): Map<string, Vec3> {
  return useMemo(() => {
    const positions = new Map<string, Vec3>()

    // --- Group by depth ---
    const byDepth: Agent[][] = [[], [], []]
    for (const agent of agents) {
      const depth = getDepth(agent, agents)
      byDepth[Math.min(depth, 2)].push(agent)
    }

    const occupied: Vec3[] = []

    // --- Layer 0: roots on octahedron vertices ---
    const roots = byDepth[0]
    roots.sort((a, b) => a.agent_id.localeCompare(b.agent_id))
    for (let i = 0; i < roots.length; i++) {
      const pos = ROOT_POSITIONS[i % ROOT_POSITIONS.length]
      positions.set(roots[i].agent_id, pos)
      occupied.push(pos)
    }

    // --- Layer 1: children grouped by parent ---
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

    // --- Layer 2: grandchildren grouped by parent ---
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

    // --- Fallback for any orphaned agents beyond layer 2 ---
    for (const agent of agents) {
      if (!positions.has(agent.agent_id)) {
        const parentPos = agent.parent_id ? positions.get(agent.parent_id) : undefined
        const anchor = parentPos || [0, 0, 30]
        const pos = enforceMinDistance(fallbackPosition(anchor), occupied)
        positions.set(agent.agent_id, pos)
        occupied.push(pos)
      }
    }

    return positions
  }, [agents])
}

// Re-export so consumers don't need to import from two files
export { useChildrenMap } from '../utils/agent-hierarchy'
