import { useEffect, useRef, useState, useCallback } from 'react'

export interface SmoothTypewriterState {
  /** 当前已显示的文本 */
  displayText: string
  /** 是否正在打字 */
  isTyping: boolean
  /** 进度 0~1 */
  progress: number
}

export interface SmoothTypewriterOptions {
  /** 完整目标文本 */
  text: string
  /** 是否开始打字 */
  start: boolean
  /** 基础每字符延迟(ms)，默认 18 */
  baseSpeed?: number
  /** 最小每帧输出字符数，默认 1 */
  minCharsPerFrame?: number
  /** 最大每帧输出字符数，默认 8 */
  maxCharsPerFrame?: number
  /** 初始延迟(ms)，默认 200 */
  initialDelay?: number
}

/**
 * 自适应平滑打字机 Hook
 *
 * 使用 requestAnimationFrame 实现，避免 setTimeout 在 tab 切换时的堆积问题。
 * 自适应速度：内容少时慢（有沉浸感），内容多时自动加速（不拖沓）。
 */
export function useSmoothTypewriter(
  options: SmoothTypewriterOptions
): SmoothTypewriterState {
  const {
    text,
    start,
    baseSpeed = 18,
    minCharsPerFrame = 1,
    maxCharsPerFrame = 8,
    initialDelay = 200,
  } = options

  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [progress, setProgress] = useState(0)

  const textRef = useRef(text)
  const startRef = useRef(start)
  const rafRef = useRef<number | null>(null)
  const stateRef = useRef({
    index: 0,
    lastFrameTime: 0,
    started: false,
  })

  // Keep refs in sync
  textRef.current = text
  startRef.current = start

  const tick = useCallback((time: number) => {
    const full = textRef.current
    const s = stateRef.current

    if (!startRef.current) {
      rafRef.current = null
      return
    }

    if (!s.started) {
      if (time < s.lastFrameTime + initialDelay) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      s.started = true
      setIsTyping(true)
    }

    const elapsed = time - s.lastFrameTime
    // 计算本帧应输出多少字符：
    // 剩余字符越多，每帧输出越多（加速）；剩余越少，每帧输出越少（减速）
    const remaining = full.length - s.index
    const adaptiveFactor = Math.max(0.2, Math.min(2, remaining / 80))
    const charsPerMs = adaptiveFactor / baseSpeed
    const charsThisFrame = Math.max(
      minCharsPerFrame,
      Math.min(maxCharsPerFrame, Math.floor(elapsed * charsPerMs))
    )

    const nextIndex = Math.min(full.length, s.index + charsThisFrame)

    if (nextIndex !== s.index) {
      s.index = nextIndex
      const current = full.slice(0, nextIndex)
      setDisplayText(current)
      setProgress(full.length > 0 ? nextIndex / full.length : 1)
    }

    s.lastFrameTime = time

    if (s.index >= full.length) {
      setIsTyping(false)
      rafRef.current = null
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [baseSpeed, initialDelay, minCharsPerFrame, maxCharsPerFrame])

  useEffect(() => {
    if (!start) {
      // Reset state when not started
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      stateRef.current = { index: 0, lastFrameTime: performance.now(), started: false }
      setDisplayText('')
      setIsTyping(false)
      setProgress(0)
      return
    }

    // Start typing
    stateRef.current = { index: 0, lastFrameTime: performance.now(), started: false }
    setDisplayText('')
    setIsTyping(false)
    setProgress(0)

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [start, text, tick])

  return { displayText, isTyping, progress }
}
