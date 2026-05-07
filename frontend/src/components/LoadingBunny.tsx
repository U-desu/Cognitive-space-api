import { useState, useEffect } from 'react'

interface Props {
  query: string
}

const MESSAGES = [
  '正在梳理你的问题...',
  '召唤不同视角的角色...',
  '构建认知空间...',
  '分析立场与冲突...',
  '马上就好啦 🐰',
]

export default function LoadingBunny({ query }: Props) {
  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100
        const step = Math.random() * 12 + 4
        return Math.min(100, p + step)
      })
    }, 180)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length)
    }, 900)
    return () => clearInterval(interval)
  }, [])

  const barWidth = Math.min(progress, 100)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-rose-50 via-white to-amber-50/30">
      {/* 小兔子 SVG */}
      <div className="relative mb-10">
        <svg viewBox="0 0 200 200" width="140" height="140" className="drop-shadow-lg">
          {/* 身体 */}
          <ellipse cx="100" cy="142" rx="48" ry="42" fill="#ffe4e6" />
          {/* 头 */}
          <circle cx="100" cy="82" r="40" fill="#fff0f5" />
          {/* 耳朵外 */}
          <ellipse cx="76" cy="36" rx="13" ry="34" fill="#ffe4e6" transform="rotate(-14 76 36)" />
          <ellipse cx="124" cy="36" rx="13" ry="34" fill="#ffe4e6" transform="rotate(14 124 36)" />
          {/* 耳朵内 */}
          <ellipse cx="76" cy="42" rx="7" ry="22" fill="#fecdd3" transform="rotate(-14 76 42)" />
          <ellipse cx="124" cy="42" rx="7" ry="22" fill="#fecdd3" transform="rotate(14 124 42)" />
          {/* 眼睛 */}
          <circle cx="84" cy="76" r="4.5" fill="#374151" />
          <circle cx="116" cy="76" r="4.5" fill="#374151" />
          {/* 眼白高光 */}
          <circle cx="85.5" cy="74.5" r="1.5" fill="white" />
          <circle cx="117.5" cy="74.5" r="1.5" fill="white" />
          {/* 腮红 */}
          <circle cx="72" cy="90" r="7" fill="#fda4af" opacity="0.5" />
          <circle cx="128" cy="90" r="7" fill="#fda4af" opacity="0.5" />
          {/* 鼻子 */}
          <ellipse cx="100" cy="86" rx="4.5" ry="3.5" fill="#fb7185" />
          {/* 嘴 */}
          <path d="M95 93 Q100 98 105 93" stroke="#fb7185" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          {/* 脚 */}
          <ellipse cx="72" cy="178" rx="13" ry="9" fill="#ffe4e6" />
          <ellipse cx="128" cy="178" rx="13" ry="9" fill="#ffe4e6" />
          {/* 手 */}
          <ellipse cx="56" cy="132" rx="9" ry="13" fill="#ffe4e6" transform="rotate(-22 56 132)" />
          <ellipse cx="144" cy="132" rx="9" ry="13" fill="#ffe4e6" transform="rotate(22 144 132)" />
          {/* 尾巴 */}
          <circle cx="145" cy="150" r="10" fill="#fff0f5" />
        </svg>

        {/* 腮红动画 */}
        <div className="absolute top-[72px] left-[34px] w-3.5 h-3.5 rounded-full bg-rose-300/40 animate-ping" />
        <div className="absolute top-[72px] right-[34px] w-3.5 h-3.5 rounded-full bg-rose-300/40 animate-ping" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* 问题文案 */}
      <div className="mb-8 text-center max-w-lg">
        <p className="text-sm text-rose-400 font-bold mb-2">🧭 决策罗盘</p>
        <p className="text-lg text-gray-700 font-bold leading-relaxed">{query}</p>
      </div>

      {/* 进度条容器 */}
      <div className="w-full max-w-sm mb-4 relative">
        {/* 轨道 */}
        <div className="h-3 rounded-full bg-amber-100 overflow-hidden">
          {/* 填充 */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-300 transition-all duration-200 ease-out"
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* 小兔子位置指示器（在进度条上方跳跃） */}
        <div
          className="absolute -top-7 transition-all duration-200 ease-out"
          style={{ left: `calc(${barWidth}% - 14px)` }}
        >
          <div className="animate-bounce">
            <svg viewBox="0 0 40 40" width="28" height="28">
              <circle cx="20" cy="20" r="18" fill="#fff0f5" stroke="#fb7185" strokeWidth="2" />
              <ellipse cx="12" cy="10" rx="4" ry="10" fill="#ffe4e6" transform="rotate(-12 12 10)" />
              <ellipse cx="28" cy="10" rx="4" ry="10" fill="#ffe4e6" transform="rotate(12 28 10)" />
              <circle cx="16" cy="20" r="2" fill="#374151" />
              <circle cx="24" cy="20" r="2" fill="#374151" />
              <ellipse cx="20" cy="25" rx="2.5" ry="2" fill="#fb7185" />
            </svg>
          </div>
        </div>
      </div>

      {/* 百分比 */}
      <p className="text-xs font-bold text-amber-400 mb-6">{Math.round(barWidth)}%</p>

      {/* 动态文案 */}
      <p className="text-sm text-gray-400 font-medium animate-pulse transition-opacity duration-300">
        {MESSAGES[msgIdx]}
      </p>
    </div>
  )
}
