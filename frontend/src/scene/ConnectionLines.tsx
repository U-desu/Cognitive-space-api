import ConnectionLine from './ConnectionLine'
import ParticleTrail from './ParticleTrail'
import { offsetTowards, type Vec3 } from '../utils/vectors'
import { STANCE_COLORS, USER_AGENT_ID } from '../constants'
import {
  AGENT_CIRCLE_RADIUS,
  CENTER_CIRCLE_RADIUS,
} from './constants'
import type { Agent } from '../api-types'

interface ConnectionLinesProps {
  agents: Agent[]
  positions: Map<string, Vec3>
  selectedAgent: string | null
  hoveredAgent: string | null
  highlightedId: string | null
  isDark: boolean
}

/**
 * Render both parent->child (dashed) and root->center (solid) lines.
 * Endpoints are offset inward so lines visually connect to circle edges
 * rather than passing through node centers.
 */
export default function ConnectionLines({
  agents,
  positions,
  selectedAgent,
  hoveredAgent,
  highlightedId,
  isDark,
}: ConnectionLinesProps) {
  const lineColor = isDark ? '#e2e8f0' : '#1e293b'

  return (
    <>
      {/* Parent → child dashed lines */}
      {agents.map((agent) => {
        if (!agent.parent_id) return null
        const rawFrom = positions.get(agent.parent_id)
        const rawTo = positions.get(agent.agent_id)
        if (!rawFrom || !rawTo) return null

        const isSel = selectedAgent === agent.agent_id
        const isHov = hoveredAgent === agent.agent_id
        const opacity = isSel ? 0.9 : isHov ? 0.75 : 0.6
        const isHighlighted =
          highlightedId === agent.agent_id || highlightedId === agent.parent_id

        const from = offsetTowards(rawFrom, rawTo, AGENT_CIRCLE_RADIUS)
        const to = offsetTowards(rawTo, rawFrom, AGENT_CIRCLE_RADIUS)

        return (
          <group key={`pc-${agent.agent_id}`}>
            <ConnectionLine
              from={from}
              to={to}
              color={lineColor}
              opacity={opacity}
              dashed
              dashScale={2.5}
              isNetworkHighlighted={isHighlighted}
            />
            <ParticleTrail from={from} to={to} active={isHighlighted} />
          </group>
        )
      })}

      {/* Root → center solid lines */}
      {agents
        .filter((a) => !a.parent_id)
        .map((agent) => {
          const rawPos = positions.get(agent.agent_id)
          if (!rawPos) return null
          const rootColor = STANCE_COLORS[agent.stance] || '#94a3b8'
          const isSel = selectedAgent === agent.agent_id
          const isHighlighted =
            highlightedId === agent.agent_id || highlightedId === USER_AGENT_ID

          const from = offsetTowards([0, 0, 0], rawPos, CENTER_CIRCLE_RADIUS)
          const to = offsetTowards(rawPos, [0, 0, 0], AGENT_CIRCLE_RADIUS)

          return (
            <group key={`rc-${agent.agent_id}`}>
              <ConnectionLine
                from={from}
                to={to}
                color={rootColor}
                opacity={isSel ? 0.7 : 0.4}
                isNetworkHighlighted={isHighlighted}
              />
              <ParticleTrail from={from} to={to} active={isHighlighted} />
            </group>
          )
        })}
    </>
  )
}
