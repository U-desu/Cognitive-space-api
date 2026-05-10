import React, { createContext, useContext, useReducer } from 'react'
import type { Space, Edge, Debate, Trajectory } from '../api-types'

interface State {
  space: Space | null
  edges: Edge[]
  debate: Debate | null
  trajectory: Trajectory | null
  loading: boolean
  error: string | null
  spacesHistory: Space[]
}

type Action =
  | { type: 'SET_SPACE'; payload: Space }
  | { type: 'SET_EDGES'; payload: Edge[] }
  | { type: 'SET_DEBATE'; payload: Debate }
  | { type: 'SET_TRAJECTORY'; payload: Trajectory }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'APPEND_AGENTS'; payload: { agents: Space['agents']; edges?: Edge[] } }
  | { type: 'SET_HISTORY'; payload: Space[] }
  | { type: 'REMOVE_HISTORY_ITEM'; payload: string }

const initialState: State = {
  space: null,
  edges: [],
  debate: null,
  trajectory: null,
  loading: false,
  error: null,
  spacesHistory: [],
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SPACE':
      return { ...state, space: action.payload, edges: [], debate: null, trajectory: null }
    case 'SET_HISTORY':
      return { ...state, spacesHistory: action.payload }
    case 'REMOVE_HISTORY_ITEM':
      return { ...state, spacesHistory: state.spacesHistory.filter(h => h.space_id !== action.payload) }
    case 'SET_EDGES':
      return { ...state, edges: action.payload }
    case 'SET_DEBATE':
      return { ...state, debate: action.payload }
    case 'SET_TRAJECTORY':
      return { ...state, trajectory: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'APPEND_AGENTS':
      if (!state.space) return state
      return {
        ...state,
        space: {
          ...state.space,
          agents: [...state.space.agents, ...action.payload.agents],
        },
        edges: action.payload.edges ?? state.edges,
      }
    default:
      return state
  }
}

const SpaceContext = createContext<{
  state: State
  dispatch: React.Dispatch<Action>
} | null>(null)

export type { State, Action }

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <SpaceContext.Provider value={{ state, dispatch }}>
      {children}
    </SpaceContext.Provider>
  )
}

export function useSpaceState() {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpaceState must be inside SpaceProvider')
  return ctx
}
