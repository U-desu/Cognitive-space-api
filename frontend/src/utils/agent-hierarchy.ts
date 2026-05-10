import { useMemo } from 'react'
import type { Agent } from '../api-types'

/**
 * Count how many parent links exist between this agent and a root.
 * Roots (no parent_id) have depth 0, their children depth 1, etc.
 */
export function getDepth(agent: Agent, agents: Agent[]): number {
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
 * Build a plain Map of parent_id → child agents.
 * O(n) single pass — safe to call inside useMemo.
 */
export function buildChildrenMap(agents: Agent[]): Map<string, Agent[]> {
  const map = new Map<string, Agent[]>()
  for (const a of agents) {
    if (a.parent_id) {
      const list = map.get(a.parent_id) || []
      list.push(a)
      map.set(a.parent_id, list)
    }
  }
  return map
}

/** React hook wrapper around buildChildrenMap */
export function useChildrenMap(agents: Agent[]): Map<string, Agent[]> {
  return useMemo(() => buildChildrenMap(agents), [agents])
}
