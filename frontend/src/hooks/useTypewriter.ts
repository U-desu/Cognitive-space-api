import { useState, useEffect } from 'react'

interface TypewriterState {
  text: string
  done: boolean
}

/**
 * 打字机效果 Hook
 * @param fullText 完整文本
 * @param start    是否开始打字
 * @param speedMs  每个字符间隔（ms），默认中文 28ms，英文 14ms
 */
export function useTypewriter(
  fullText: string,
  start: boolean,
  speedMs: number = 28
): TypewriterState {
  const [state, setState] = useState<TypewriterState>({ text: '', done: false })

  useEffect(() => {
    if (!start || !fullText) {
      setState({ text: '', done: false })
      return
    }
    setState({ text: '', done: false })

    let i = 0
    const tick = () => {
      i++
      if (i >= fullText.length) {
        setState({ text: fullText, done: true })
        return
      }
      setState({ text: fullText.slice(0, i), done: false })
      // 动态间隔：中文字符稍慢，英文/标点稍快
      const char = fullText[i - 1] ?? ''
      const isCJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)
      const delay = isCJK ? speedMs : Math.max(speedMs * 0.5, 10)
      timer = setTimeout(tick, delay)
    }

    let timer = setTimeout(tick, 300) // 首字延迟，营造"思考中"感
    return () => clearTimeout(timer)
  }, [fullText, start, speedMs])

  return state
}

/**
 * 顺序揭示 Hook：按顺序逐个 reveal turn，每个 turn 用打字机打出
 * @param turns   扁平化的 turn 列表
 * @param enabled 是否开始揭示
 */
export function useSequentialReveal<T extends { content: string }>(
  turns: T[],
  enabled: boolean
) {
  const [revealed, setRevealed] = useState<T[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // 重置
  useEffect(() => {
    if (!enabled) {
      setRevealed([])
      setCurrentIndex(0)
      setCurrentText('')
      setIsTyping(false)
      setIsComplete(false)
    }
  }, [enabled, turns.length])

  // 打字机逻辑
  useEffect(() => {
    if (!enabled || turns.length === 0) return
    if (currentIndex >= turns.length) {
      setIsComplete(true)
      setIsTyping(false)
      setCurrentText('')
      return
    }

    const turn = turns[currentIndex]
    const fullText = turn.content
    setIsTyping(true)
    setCurrentText('')

    let i = 0
    const startDelay = currentIndex === 0 ? 400 : 600 // 首个 turn 稍快开始

    const tick = () => {
      i++
      if (i >= fullText.length) {
        setCurrentText(fullText)
        setIsTyping(false)
        // 这个 turn 打完了，加入 revealed，延迟后进入下一个
        setTimeout(() => {
          setRevealed((prev) => [...prev, turn])
          setCurrentIndex((prev) => prev + 1)
        }, 500)
        return
      }
      setCurrentText(fullText.slice(0, i))
      const char = fullText[i - 1] ?? ''
      const isCJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)
      const delay = isCJK ? 26 : 12
      timer = setTimeout(tick, delay)
    }

    let timer = setTimeout(tick, startDelay)
    return () => clearTimeout(timer)
  }, [enabled, currentIndex, turns])

  const currentTurn = currentIndex < turns.length ? turns[currentIndex] : null

  return {
    revealed,      // 已完整显示的 turns
    currentTurn,   // 当前正在打的 turn（未加入 revealed）
    currentText,   // 当前打字机已打出的文本
    isTyping,      // 是否正在打字
    isComplete,    // 是否全部完成
    progress: turns.length > 0 ? (revealed.length / turns.length) : 0,
  }
}
