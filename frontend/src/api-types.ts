// Auto-generated from openapi.json + manual supplements
// DO NOT EDIT MANUALLY — update backend models and regenerate

export interface Agent {
  agent_id: string
  name: string
  persona?: string
  position: Position
  stance: Stance
  confidence?: number
  domain?: string
  summary?: string
  parent_id?: string
}

export interface Position {
  authority: number
  novelty: number
}

export type Stance = 'pro' | 'con' | 'neutral'

export interface Space {
  space_id: string
  query: string
  dimensions: Record<string, Dimension>
  agents: Agent[]
  metadata: SpaceMetadata
  user_id?: string
  query_embedding?: number[]
  created_at?: string
}

export interface Dimension {
  name: string
  label: string
  range: number[]
}

export interface SpaceMetadata {
  space_type?: string
  complexity?: string
  estimated_nodes?: number
}

export interface CreateSpaceRequest {
  query: string
  user_context?: Record<string, unknown>
}

export interface Edge {
  edge_id: string
  source: string
  target: string
  conflict_score: number
  conflict_type: 'fundamental' | 'partial' | 'minor'
  shared_ground: string[]
  divergence_axes: DivergenceAxis[]
  debate_recommended: boolean
}

export interface DivergenceAxis {
  axis: string
  a_stance: string
  b_stance: string
}

export interface SpaceStats {
  conflict_density: number
  consensus_clusters: number
  diversity_index: number
}

export interface DebateRequest {
  edge_id: string
  format?: string
  rounds?: number
  focus_axes?: string[]
}

export interface Debate {
  debate_id: string
  edge_id: string
  participants: string[]
  transcript: DebateRound[]
  synthesis: Synthesis
  visualization: Record<string, unknown>
}

export interface DebateRound {
  round: number
  turns: DebateTurn[]
}

export interface DebateTurn {
  agent: string
  type: string
  content: string
  evidence: string[]
}

export interface Synthesis {
  core_conflict: string
  resolution_suggestion: string
  agreement_points: string[]
  divergence_points: string[]
}

export interface Trajectory {
  trajectory_id: string
  space_id: string
  path: TrajectoryPoint[]
  cognitive_metrics: Record<string, number>
  journey_stage: string
  suggested_next: Record<string, unknown>
}

export interface TrajectoryPoint {
  node: string
  timestamp: number
  action: string
  dwell_time: number
}

// ── Aggregator types (migrated from frontend mock) ──

export interface ExternalUser {
  name: string
  avatar: string
  title: string
  followers: string
  url: string
  domain: string
}

export interface ExternalQuestion {
  title: string
  url: string
  views: string
  domain: string
}

export interface HotQuestionPreset {
  icon_type: string
  label: string
  text: string
  color: string
}

// ── Auth types ──

export interface ExpandAgentRequest {
  query_hint: string
  num_agents: number
  user_context?: Record<string, unknown>
}

export interface ExpandAgentResponse {
  parent_agent_id: string
  new_agents: Agent[]
}

/** 前端调用 Gateway expand 端点时发送的简化请求体 */
export interface AgentExpandPayload {
  query_hint: string
  num_agents: number
}

export interface User {
  user_id: string
  username: string
  email?: string
  avatar?: string
  auth_provider: string
  created_at: number
}

// ── History / Deduplication types ──

export interface SpaceHistoryItem {
  space_id: string
  query: string
  created_at: string
  agent_count: number
}

/** createSpace 的返回结构（包含去重信息） */
export interface CreateSpaceResult {
  space: Space
  reused: boolean
  similarity: number
}
