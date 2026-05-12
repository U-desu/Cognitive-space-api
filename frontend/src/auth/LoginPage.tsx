import { useState } from 'react'
import { useTheme } from '../theme/ThemeContext'
import ThemeSwitcher from '../theme/ThemeSwitcher'
import Logo from '../components/Logo'

/* ─── 主题感知背景装饰 ─── */
function TechBackground() {
  const { theme } = useTheme()

  const config = {
    cyberpunk: {
      glows: [
        { color: '#00f0ff', x: '10%', y: '15%', size: 300, blur: 120 },
        { color: '#ff00a0', x: '85%', y: '20%', size: 250, blur: 100 },
        { color: '#b026ff', x: '50%', y: '85%', size: 350, blur: 140 },
      ],
      lines: 'rgba(0,240,255,0.04)',
    },
    deepspace: {
      glows: [
        { color: '#3b82f6', x: '15%', y: '20%', size: 320, blur: 130 },
        { color: '#8b5cf6', x: '80%', y: '25%', size: 280, blur: 110 },
        { color: '#06b6d4', x: '45%', y: '80%', size: 300, blur: 120 },
      ],
      lines: 'rgba(59,130,246,0.03)',
    },
    matrix: {
      glows: [
        { color: '#00ff88', x: '12%', y: '18%', size: 280, blur: 110 },
        { color: '#00d4aa', x: '82%', y: '22%', size: 260, blur: 100 },
        { color: '#f59e0b', x: '50%', y: '82%', size: 340, blur: 130 },
      ],
      lines: 'rgba(0,255,136,0.03)',
    },
    zhihu: {
      glows: [
        { color: '#0084ff', x: '10%', y: '15%', size: 300, blur: 120 },
        { color: '#00b4ff', x: '85%', y: '20%', size: 250, blur: 100 },
        { color: '#0066ff', x: '50%', y: '85%', size: 350, blur: 140 },
      ],
      lines: 'rgba(0,132,255,0.03)',
    },
  }

  const c = config[theme]

  return (
    <>
      {/* 网格线 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${c.lines} 1px, transparent 1px), linear-gradient(90deg, ${c.lines} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      {/* 光晕 */}
      {c.glows.map((g, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: g.x,
            top: g.y,
            width: g.size,
            height: g.size,
            transform: 'translate(-50%, -50%)',
            background: g.color,
            filter: `blur(${g.blur}px)`,
            opacity: 0.12,
          }}
        />
      ))}
    </>
  )
}

export default function LoginPage() {
  const { theme } = useTheme()
  const [error, setError] = useState('')

  const accentColors = {
    cyberpunk: '#00f0ff',
    deepspace: '#3b82f6',
    matrix: '#00ff88',
    zhihu: '#0084ff',
  }
  const accent = accentColors[theme]

  const handleZhihu = async () => {
    try {
      const { api } = await import('../api')
      const data = await api.getZhihuAuthUrl()
      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || '知乎登录失败')
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-space-bg">
      <TechBackground />

      {/* 顶部主题切换 */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          className="backdrop-blur-xl rounded-[2rem] shadow-2xl border p-8 md:p-10"
          style={{
            backgroundColor: theme === 'cyberpunk' ? 'rgba(15,15,26,0.9)' : theme === 'deepspace' ? 'rgba(30,41,59,0.9)' : theme === 'zhihu' ? 'rgba(255,255,255,0.9)' : 'rgba(15,31,20,0.9)',
            borderColor: accent + '25',
            boxShadow: `0 25px 50px -12px ${accent}18`,
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4"
              style={{
                background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
                border: `1px solid ${accent}30`,
              }}
            >
              <Logo size={36} />
            </div>
            <h1 className="text-2xl font-extrabold text-space-text tracking-tight">
              认知空间
            </h1>
            <p className="text-sm text-space-muted mt-1">
              探索分歧，发现共识
            </p>
          </div>

          {error && (
            <p className="text-rose-500 text-sm text-center rounded-lg py-2 mb-4" style={{ backgroundColor: 'rgba(255,0,0,0.06)' }}>
              {error}
            </p>
          )}

          <button
            onClick={handleZhihu}
            className="w-full py-3 rounded-xl text-white hover:opacity-90 flex items-center justify-center gap-2 font-medium transition-all shadow-lg"
            style={{ backgroundColor: '#0084ff', border: `1px solid ${accent}20` }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.56C21.751 24 24 21.75 24 18.281V5.72C24 2.249 21.75 0 18.281 0zm1.964 4.078c-.271.73-.5 1.434-.68 2.11h4.587c.545-.006.445 1.168.445 1.168H6.283c-.036.593-.114 1.196-.114 1.796h6.652s.4 1.143-.312 1.143H9.064c-.076.734-.166 1.465-.166 2.186 0 3.572 1.855 5.692 4.56 6.961-.282.224-.565.45-.834.69 1.813-.963 3.312-2.568 3.922-4.744.17.626.26 1.29.26 1.987 0 3.48-2.497 5.83-4.908 6.986 2.754-2.074 4.492-5.395 4.492-8.974 0-.59-.066-1.165-.184-1.725h2.102s.312-1.143-.363-1.143h-2.38c-.038-.6-.076-1.204-.1-1.796h3.704s.545-1.168.03-1.168h-4.13a34.044 34.044 0 00-.66-2.11h2.73s.486-1.055-.178-1.055H8.813z" />
            </svg>
            使用知乎登录
          </button>
        </div>
      </div>
    </div>
  )
}
