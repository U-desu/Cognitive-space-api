import type {
  Space,
  CreateSpaceRequest,
  Edge,
  SpaceStats,
  DebateRequest,
  Debate,
  Trajectory,
  ExternalUser,
  ExternalQuestion,
  HotQuestionPreset,
  User,
  AgentExpandPayload,
} from './api-types'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

/** 构建请求头 */
function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: buildHeaders({}),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: buildHeaders({}),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

export const api = {
  // Core / Gateway orchestrated
  createSpace: async (req: CreateSpaceRequest): Promise<{ space: Space; reused: boolean; similarity: number }> => {
    const res = await fetch(`${BASE}/spaces`, {
      method: 'POST',
      headers: buildHeaders(),
      credentials: 'include',
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
    const space = await res.json()
    const reused = res.headers.get('X-Space-Reused') === 'true'
    const similarity = parseFloat(res.headers.get('X-Similarity') || '0')
    return { space, reused, similarity }
  },
  getSpace: (id: string) => get<Space>(`/spaces/${id}`),
  computeEdges: (id: string) =>
    post<{ edges: Edge[]; space_stats: SpaceStats }>(`/spaces/${id}/edges`),
  createDebate: (id: string, req: DebateRequest) =>
    post<Debate>(`/spaces/${id}/debates`, req),
  getDebatesByEdge: (edgeId: string) =>
    get<Debate[]>(`/debates/by-edge/${edgeId}`),
  /**
   * Stream debate generation via SSE.
   * Use hooks/useDebateStream.ts instead of calling this directly.
   */
  createDebateStreamUrl: (spaceId: string) => `${BASE}/spaces/${spaceId}/debates/stream`,
  getTrajectory: (id: string) => get<Trajectory>(`/spaces/${id}/trajectory`),
  exportSpace: (id: string, payload: { format: string }) =>
    post<Record<string, unknown>>(`/spaces/${id}/export`, payload),
  getMySpaces: () => get<Space[]>('/spaces/my'),
  getSpaceHistory: () => get<Space[]>('/spaces/history'),
  deleteSpaceHistory: (spaceId: string) => del<void>(`/spaces/${spaceId}`),
  expandAgent: (spaceId: string, agentId: string, req: AgentExpandPayload) =>
    post<Space>(`/spaces/${spaceId}/agents/${agentId}/expand`, req),

  // Auth
  getZhihuAuthUrl: () => get<{ url: string }>('/auth/zhihu/authorize'),
  register: (body: { username: string; password: string; email?: string }) =>
    post<{ user: User }>('/auth/register', body),
  login: (body: { username: string; password: string }) =>
    post<{ user: User }>('/auth/login', body),
  getMe: () => get<{ user: User | null }>('/auth/me'),
  logout: () => post<void>('/auth/logout'),

  // Aggregator (previously frontend mock data)
  getZhihuUsers: (domain: string) =>
    get<ExternalUser[]>(`/aggregator/zhihu/users?domain=${encodeURIComponent(domain)}`),
  getZhihuQuestions: (query: string) =>
    get<ExternalQuestion[]>(`/aggregator/zhihu/questions?query=${encodeURIComponent(query)}`),
  getHotQuestions: () =>
    get<HotQuestionPreset[]>('/aggregator/presets/hot-questions'),
  getDomainLabels: () =>
    get<Record<string, string>>('/aggregator/domain-labels'),
}
