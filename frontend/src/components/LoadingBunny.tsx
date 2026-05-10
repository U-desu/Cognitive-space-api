import { useState, useEffect } from 'react'
import { useTheme } from '../theme/ThemeContext'
import Logo from './Logo'

interface Props {
  query: string
}

const MESSAGES = [
  '正在梳理你的问题...',
  '召唤不同视角的角色...',
  '构建认知空间...',
  '分析立场与冲突...',
  '马上就好啦',
]

export default function LoadingBunny({ query }: Props) {
  const [progress, setProgress] = useState(0)
  const [msgIdx, setMsgIdx] = useState(0)
  const { theme } = useTheme()

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

  const accentColors = {
    cyberpunk: { primary: '#00f0ff', secondary: '#ff00a0', track: 'rgba(0,240,255,0.1)' },
    deepspace: { primary: '#3b82f6', secondary: '#8b5cf6', track: 'rgba(59,130,246,0.1)' },
    matrix: { primary: '#00ff88', secondary: '#f59e0b', track: 'rgba(0,255,136,0.1)' },
  }
  const accent = accentColors[theme]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-space-bg">
      {/* 科技脉冲圆环 */}
      <div className="relative mb-10">
        <div
          className="w-32 h-32 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: accent.primary + '30' }}
        >
          <div
            className="w-24 h-24 rounded-full border flex items-center justify-center animate-pulse"
            style={{ borderColor: accent.primary + '50' }}
          >
            <Logo size={48} />
          </div>
        </div>
        {/* 旋转光环 */}
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: `2px dashed ${accent.primary}25`,
            animationDuration: '8s',
          }}
        />
      </div>

      {/* 问题文案 */}
      <div className="mb-8 text-center max-w-lg">
        <p className="text-sm font-bold mb-2" style={{ color: accent.primary }}>
          认知空间
        </p>
        <p className="text-lg text-space-text font-bold leading-relaxed">{query}</p>
      </div>

      {/* 进度条容器 */}
      <div className="w-full max-w-sm mb-4 relative">
        <div
          className="h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: accent.track }}
        >
          <div
            className="h-full rounded-full transition-all duration-200 ease-out"
            style={{
              width: `${barWidth}%`,
              background: `linear-gradient(90deg, ${accent.primary}, ${accent.secondary})`,
              boxShadow: `0 0 12px ${accent.primary}50`,
            }}
          />
        </div>
      </div>

      {/* 百分比 */}
      <p className="text-xs font-bold mb-6" style={{ color: accent.primary }}>
        {Math.round(barWidth)}%
      </p>

      {/* 动态文案 */}
      <p className="text-sm text-space-muted font-medium animate-pulse transition-opacity duration-300">
        {MESSAGES[msgIdx]}
      </p>
    </div>
  )
}
