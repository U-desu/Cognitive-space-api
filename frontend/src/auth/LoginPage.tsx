import { useState } from 'react'
import { useAuth } from './useAuth'

/* ─── 漂浮小动物组件 ─── */
function FloatingAnimal({ emoji, size, delay, duration, x, y }: {
  emoji: string
  size: number
  delay: number
  duration: number
  x: string
  y: string
}) {
  return (
    <span
      className="absolute select-none pointer-events-none"
      style={{
        left: x,
        top: y,
        fontSize: size,
        opacity: 0.35,
        animation: `float ${duration}s ease-in-out ${delay}s infinite alternate`,
      }}
    >
      {emoji}
    </span>
  )
}

const ANIMALS = [
  { emoji: '🐰', size: 48, delay: 0, duration: 4, x: '8%', y: '12%' },
  { emoji: '🐱', size: 36, delay: 1, duration: 5, x: '85%', y: '18%' },
  { emoji: '🐻', size: 44, delay: 0.5, duration: 4.5, x: '15%', y: '75%' },
  { emoji: '🦊', size: 32, delay: 2, duration: 3.5, x: '78%', y: '70%' },
  { emoji: '🐼', size: 40, delay: 1.5, duration: 5.5, x: '5%', y: '45%' },
  { emoji: '🐨', size: 34, delay: 0.8, duration: 4.2, x: '90%', y: '45%' },
  { emoji: '🐥', size: 28, delay: 2.5, duration: 3, x: '50%', y: '8%' },
  { emoji: '🐶', size: 38, delay: 1.2, duration: 5, x: '30%', y: '85%' },
  { emoji: '🐹', size: 26, delay: 0.3, duration: 3.8, x: '65%', y: '88%' },
  { emoji: '🦋', size: 30, delay: 3, duration: 4, x: '42%', y: '15%' },
  { emoji: '🌸', size: 24, delay: 1.8, duration: 5, x: '22%', y: '30%' },
  { emoji: '⭐', size: 22, delay: 0.6, duration: 3.5, x: '72%', y: '28%' },
]

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #fff0f5 0%, #fffacd 50%, #ffffff 100%)',
      }}
    >
      {/* 动态小动物背景 */}
      {ANIMALS.map((a, i) => (
        <FloatingAnimal key={i} {...a} />
      ))}

      {/* 装饰圆点 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-72 h-72 rounded-full opacity-20"
          style={{ background: '#ffb6c1', top: '-5%', left: '-5%', filter: 'blur(60px)' }} />
        <div className="absolute w-96 h-96 rounded-full opacity-15"
          style={{ background: '#fffacd', bottom: '-10%', right: '-10%', filter: 'blur(80px)' }} />
        <div className="absolute w-64 h-64 rounded-full opacity-20"
          style={{ background: '#e6e6fa', top: '40%', left: '60%', filter: 'blur(50px)' }} />
      </div>

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/60 p-8 md:p-10"
          style={{ boxShadow: '0 25px 50px -12px rgba(255, 182, 193, 0.25)' }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-300 to-yellow-200 shadow-lg mb-4 animate-bounce-slow">
              <span className="text-3xl">🐰</span>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">
              认知空间
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              探索分歧，发现共识 ✨
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-pink-100 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all text-gray-700 placeholder-gray-300"
                placeholder="输入用户名"
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  邮箱（可选）
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border-2 border-pink-100 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all text-gray-700 placeholder-gray-300"
                  placeholder="your@email.com"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-pink-100 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all text-gray-700 placeholder-gray-300"
                placeholder={mode === 'register' ? '至少 6 位密码' : '输入密码'}
                required
                minLength={mode === 'register' ? 6 : undefined}
              />
            </div>

            {error && (
              <p className="text-rose-500 text-sm text-center bg-rose-50 rounded-lg py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-400 to-pink-300 hover:from-pink-500 hover:to-pink-400 text-white font-bold shadow-lg shadow-pink-200 disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>

          <div className="flex items-center my-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
            <span className="px-3 text-gray-300 text-xs">或</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
          </div>

          <button
            onClick={handleGithub}
            className="w-full py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-800 flex items-center justify-center gap-2 font-medium transition-all shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            使用 GitHub 登录
          </button>

          <p className="mt-5 text-center text-sm text-gray-400">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button onClick={() => setMode('register')} className="text-pink-500 font-semibold hover:text-pink-600 transition-colors">
                  去注册 🌸
                </button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <button onClick={() => setMode('login')} className="text-pink-500 font-semibold hover:text-pink-600 transition-colors">
                  去登录 🌟
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
