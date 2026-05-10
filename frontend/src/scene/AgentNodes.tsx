import NodeMesh from './NodeMesh'
import type { Agent } from '../api-types'

interface AgentNodesProps {
  agents: Agent[]
  positions: Map<string, [number, number, number]>
  childrenMap: Map<string, Agent[]>
  selectedAgent: string | null
  hoveredAgent: string | null
  highlightSet: Set<string>
  agentAvatarMap: Map<string, string>
  darkBg: boolean
  onAgentClick: (id: string) => void
  onExpandAgent?: (id: string) => void
  setHoveredAgent: (id: string | null) => void
  setHighlightedId: (id: string | null) => void
}

/** Render all agent nodes inside the 3D scene */
export default function AgentNodes({
  agents,
  positions,
  childrenMap,
  selectedAgent,
  hoveredAgent,
  highlightSet,
  agentAvatarMap,
  darkBg,
  onAgentClick,
  onExpandAgent,
  setHoveredAgent,
  setHighlightedId,
}: AgentNodesProps) {
  return (
    <>
      {agents.map((agent) => {
        const pos = positions.get(agent.agent_id)
        if (!pos) return null
        const isSel = selectedAgent === agent.agent_id
        const isHov = hoveredAgent === agent.agent_id
        const childList = childrenMap.get(agent.agent_id) || []

        return (
          <NodeMesh
            key={agent.agent_id}
            agent={agent}
            position={pos}
            isSelected={isSel}
            isHovered={isHov}
            hasChildren={childList.length > 0}
            childCount={childList.length}
            darkBg={darkBg}
            isNetworkHighlighted={highlightSet.has(agent.agent_id)}
            onClick={() => onAgentClick(agent.agent_id)}
            onPointerOver={() => {
              setHoveredAgent(agent.agent_id)
              setHighlightedId(agent.agent_id)
            }}
            onPointerOut={() => {
              setHoveredAgent(null)
              setHighlightedId(null)
            }}
            onExpand={onExpandAgent ? () => onExpandAgent(agent.agent_id) : undefined}
            avatarUrl={agentAvatarMap.get(agent.agent_id)}
          />
        )
      })}
    </>
  )
}
