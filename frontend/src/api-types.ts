// Auto-generated from openapi.json — DO NOT EDIT MANUALLY
// Run: python3 scripts/gen-frontend-types.py

export interface Agent {
    agent_id: string;
    name: string;
    persona?: string;
    position: Position;
    stance: Stance;
    confidence?: number;
    domain?: string;
    summary?: string;
  }

export interface Createspacerequest {
    query: string;
    user_context?: Record<string, unknown> | unknown;
  }

export interface Debaterequest {
    edge_id: string;
    format?: string;
    rounds?: number;
    focus_axes?: Array<string> | unknown;
  }

export interface Dimension {
    name: string;
    label: string;
    range: Array<number>;
  }

export interface Position {
    authority: number;
    novelty: number;
  }

export interface Space {
    space_id: string;
    query: string;
    dimensions: Record<string, unknown>;
    agents: Array<Agent>;
    metadata: Spacemetadata;
  }

export interface Spacemetadata {
    space_type?: string;
    complexity?: string;
    estimated_nodes?: number;
  }

export type Stance = "pro" | "con" | "neutral";

export interface ApiEndpoints {
  'health_check_health_get': { method: 'GET'; path: '/health' };
  'create_space_spaces_post': { method: 'POST'; path: '/spaces' };
  'get_space_spaces__space_id__get': { method: 'GET'; path: '/spaces/{space_id}' };
  'create_debate_spaces__space_id__debates_post': { method: 'POST'; path: '/spaces/{space_id}/debates' };
  'compute_edges_spaces__space_id__edges_post': { method: 'POST'; path: '/spaces/{space_id}/edges' };
  'export_space_spaces__space_id__export_post': { method: 'POST'; path: '/spaces/{space_id}/export' };
  'generate_perspectives_spaces__space_id__perspectives_post': { method: 'POST'; path: '/spaces/{space_id}/perspectives' };
  'get_trajectory_spaces__space_id__trajectory_get': { method: 'GET'; path: '/spaces/{space_id}/trajectory' };
}
