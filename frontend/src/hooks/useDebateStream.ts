import { useCallback, useRef, useState } from 'react'

export interface StreamTurn {
  round: number
  agent: string
  type: string
  content: string
  evidence: string[]
}

export interface StreamSynthesis {
  core_conflict: string
  resolution_suggestion: string
  agreement_points: string[]
  divergence_points: string[]
}

export interface StreamDone {
  debate_id: string
  space_id: string
  edge_id: string
  participants: string[]
  transcript: { round: number; turns: StreamTurn[] }[]
  synthesis: StreamSynthesis
}

export interface DebateStreamState {
  turns: StreamTurn[]
  synthesis: StreamSynthesis | null
  done: StreamDone | null
  loading: boolean
  error: string | null
}

interface UseDebateStreamReturn {
  state: DebateStreamState
  start: (spaceId: string, edgeId: string, rounds?: number) => void
  stop: () => void
  loadHistorical: (debate: {
    debate_id: string
    space_id?: string
    edge_id: string
    participants: string[]
    transcript: { round: number; turns: { agent: string; type: string; content: string; evidence: string[] }[] }[]
    synthesis: StreamSynthesis
  }) => void
}

const BASE = import.meta.env.VITE_API_BASE_URL || ''

export function useDebateStream(): UseDebateStreamReturn {
  const [state, setState] = useState<DebateStreamState>({
    turns: [],
    synthesis: null,
    done: null,
    loading: false,
    error: null,
  })

  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const start = useCallback(
    (spaceId: string, edgeId: string, rounds: number = 2) => {
      // Clean up previous stream
      stop()

      setState({
        turns: [],
        synthesis: null,
        done: null,
        loading: true,
        error: null,
      })

      // EventSource does not support POST with body.
      // We use a workaround: fetch with ReadableStream + manual SSE parsing.
      const url = `${BASE}/spaces/${spaceId}/debates/stream`

      const controller = new AbortController()
      abortRef.current = controller

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ edge_id: edgeId, format: 'structured', rounds }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text()
            throw new Error(`${res.status}: ${text}`)
          }

          const reader = res.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Parse complete SSE events (delimited by \n\n)
            const events = buffer.split('\n\n')
            buffer = events.pop() || '' // keep incomplete event in buffer

            for (const eventText of events) {
              const lines = eventText.trim().split('\n')
              let eventType = ''
              let eventData: any = null

              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  eventType = line.slice(7)
                } else if (line.startsWith('data: ')) {
                  try {
                    eventData = JSON.parse(line.slice(6))
                  } catch {
                    eventData = line.slice(6)
                  }
                }
              }

              if (!eventType || !eventData) continue

              switch (eventType) {
                case 'turn':
                  setState((prev) => ({
                    ...prev,
                    turns: [...prev.turns, eventData as StreamTurn],
                  }))
                  break
                case 'synthesis':
                  setState((prev) => ({
                    ...prev,
                    synthesis: eventData as StreamSynthesis,
                    loading: false,
                  }))
                  break
                case 'done':
                  setState((prev) => ({
                    ...prev,
                    done: eventData as StreamDone,
                    loading: false,
                  }))
                  break
              }
            }
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err.message || 'Stream failed',
          }))
        })

    },
    [stop]
  )

  const loadHistorical = useCallback(
    (debate: {
      debate_id: string
      space_id?: string
      edge_id: string
      participants: string[]
      transcript: { round: number; turns: { agent: string; type: string; content: string; evidence: string[] }[] }[]
      synthesis: StreamSynthesis
    }) => {
      stop()
      const turns: StreamTurn[] = []
      debate.transcript.forEach((r) => {
        r.turns.forEach((t) => {
          turns.push({ ...t, round: r.round })
        })
      })
      setState({
        turns,
        synthesis: debate.synthesis,
        done: {
          debate_id: debate.debate_id,
          space_id: debate.space_id || '',
          edge_id: debate.edge_id,
          participants: debate.participants,
          transcript: debate.transcript as { round: number; turns: StreamTurn[] }[],
          synthesis: debate.synthesis,
        },
        loading: false,
        error: null,
      })
    },
    [stop]
  )

  return { state, start, stop, loadHistorical }
}
