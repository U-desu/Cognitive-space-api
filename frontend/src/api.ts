import type {
  Space,
  CreateSpaceRequest,
  Edge,
  SpaceStats,
  DebateRequest,
  Debate,
  Trajectory,
} from './api-types'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return res.json()
}

export const api = {
  createSpace: (req: CreateSpaceRequest) => post<Space>('/spaces', req),
  getSpace: (id: string) => get<Space>(`/spaces/${id}`),
  computeEdges: (id: string) =>
    post<{ edges: Edge[]; space_stats: SpaceStats }>(
      `/spaces/${id}/edges`
    ),
  createDebate: (id: string, req: DebateRequest) =>
    post<Debate>(`/spaces/${id}/debates`, req),
  getTrajectory: (id: string) => get<Trajectory>(`/spaces/${id}/trajectory`),
  exportSpace: (id: string, payload: { format: string }) =>
    post<Record<string, unknown>>(`/spaces/${id}/export`, payload),
}
