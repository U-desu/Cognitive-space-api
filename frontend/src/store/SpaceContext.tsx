import React, { createContext, useContext, useReducer } from 'react'
import type { Space, Edge, Debate, Trajectory } from '../api-types'

interface State {
  space: Space | null
  edges: Edge[]
  debate: Debate | null
  trajectory: Trajectory | null
  loading: boolean
  error: string | null
}

type Action =
  | { type: 'SET_SPACE'; payload: Space }
  | { type: 'SET_EDGES'; payload: Edge[] }
  | { type: 'SET_DEBATE'; payload: Debate }
  | { type: 'SET_TRAJECTORY'; payload: Trajectory }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

const initialState: State = {
  space: null,
  edges: [],
  debate: null,
  trajectory: null,
  loading: false,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SPACE':
      return { ...state, space: action.payload, edges: [], debate: null, trajectory: null }
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
    default:
      return state
  }
}

const SpaceContext = createContext<{
  state: State
  dispatch: React.Dispatch<Action>
} | null>(null)

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
