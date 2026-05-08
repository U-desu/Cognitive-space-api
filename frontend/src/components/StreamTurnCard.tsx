import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSmoothTypewriter } from '../hooks/useSmoothTypewriter'
import type { StreamTurn } from '../hooks/useDebateStream'
import type { Agent } from '../api-types'

/** 三个跳动的小圆点 — "正在输入"指示器 */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1 align-middle">
      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
  )
}

/** 打字光标 — 闪烁竖线 */
function CursorBlink() {
  return (
    <span className="inline-block w-0.5 h-4 ml-0.5 bg-space-cyan animate-pulse align-middle" />
  )
}

interface Props {
  turn: StreamTurn
  agent?: Agent
  isTyping?: boolean
  baseSpeed?: number
}

/**
 * 统一的流式 Turn 渲染卡片
 *
 * - 使用 react-markdown 支持 Markdown 渲染（代码块、列表、加粗等）
 * - 当 isTyping=true 时，启动自适应打字机效果
 * - 已完成的 turn 直接完整显示
 */
export default function StreamTurnCard({
  turn,
  agent,
  isTyping = false,
  baseSpeed = 18,
}: Props) {
  const isPro = agent?.stance === 'pro'

  const { displayText, isTyping: typingActive } = useSmoothTypewriter({
    text: turn.content,
    start: isTyping,
    baseSpeed,
  })

  const textToShow = isTyping ? displayText : turn.content
  const showCursor = isTyping && typingActive
  const showDots = isTyping && typingActive

  return (
    <div
      className={`p-4 rounded-2xl border-2 transition-all duration-500 ${
        isPro
          ? 'border-green-100 bg-green-50'
          : 'border-rose-100 bg-rose-50'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            isPro ? 'bg-green-200 text-green-700' : 'bg-rose-200 text-rose-700'
          }`}
        >
          {agent?.name ?? turn.agent}
        </span>
        <span className="text-xs text-space-muted capitalize">
          {turn.type}
        </span>
        {showDots && <TypingDots />}
      </div>

      <div className="text-sm text-space-text leading-relaxed whitespace-pre-wrap markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {textToShow}
        </ReactMarkdown>
        {showCursor && <CursorBlink />}
      </div>
    </div>
  )
}
