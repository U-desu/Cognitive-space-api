import { useState } from 'react'
import { useAuth } from './useAuth'
import { useTheme } from '../theme/ThemeContext'
import ThemeSwitcher from '../theme/ThemeSwitcher'

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
  const { login, register } = useAuth()
  const { theme } = useTheme()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const accentColors = {
    cyberpunk: '#00f0ff',
    deepspace: '#3b82f6',
    matrix: '#00ff88',
  }
  const accent = accentColors[theme]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(username, password)
      } else {
        await register(username, password, email || undefined)
      }
    } catch (err: any) {
      setError(err.message || '认证失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGithub = async () => {
    try {
      const { api } = await import('../api')
      const data = await api.getGithubAuthUrl()
      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || 'GitHub 登录失败')
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
            backgroundColor: theme === 'cyberpunk' ? 'rgba(15,15,26,0.9)' : theme === 'deepspace' ? 'rgba(30,41,59,0.9)' : 'rgba(15,31,20,0.9)',
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
              <span className="text-3xl">🧠</span>
            </div>
            <h1 className="text-2xl font-extrabold text-space-text tracking-tight">
              认知空间
            </h1>
            <p className="text-sm text-space-muted mt-1">
              探索分歧，发现共识
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-space-text mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 transition-all text-space-text placeholder:text-gray-500"
                style={{
                  backgroundColor: 'var(--space-bg)',
                  borderColor: accent + '20',
                }}
                placeholder="输入用户名"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-space-text mb-1.5">
                  邮箱（可选）
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 transition-all text-space-text placeholder:text-gray-500"
                  style={{
                    backgroundColor: 'var(--space-bg)',
                    borderColor: accent + '20',
                  }}
                  placeholder="your@email.com"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-space-text mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 transition-all text-space-text placeholder:text-gray-500"
                style={{
                  backgroundColor: 'var(--space-bg)',
                  borderColor: accent + '20',
                }}
                placeholder={mode === 'register' ? '至少 6 位密码' : '输入密码'}
                required
                minLength={mode === 'register' ? 6 : undefined}
              />
            </div>

            {error && (
              <p className="text-rose-500 text-sm text-center rounded-lg py-2" style={{ backgroundColor: 'rgba(255,0,0,0.06)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
            >
              {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>

          <div className="flex items-center my-5">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)` }} />
            <span className="px-3 text-gray-500 text-xs">或</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)` }} />
          </div>

          <button
            onClick={handleGithub}
            className="w-full py-3 rounded-xl text-white hover:opacity-90 flex items-center justify-center gap-2 font-medium transition-all shadow-lg"
            style={{ backgroundColor: '#1a1a2e', border: `1px solid ${accent}20` }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            使用 GitHub 登录
          </button>

          <p className="mt-5 text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button
                  onClick={() => setMode('register')}
                  className="font-semibold transition-colors hover:opacity-80"
                  style={{ color: accent }}
                >
                  去注册
                </button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <button
                  onClick={() => setMode('login')}
                  className="font-semibold transition-colors hover:opacity-80"
                  style={{ color: accent }}
                >
                  去登录
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
