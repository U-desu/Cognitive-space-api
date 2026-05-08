import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SpaceProvider } from './store/SpaceContext'
import { useAuth } from './auth/useAuth'
import LoginPage from './auth/LoginPage'
import LandingPage from './components/LandingPage'
import SpacePage from './components/SpacePage'

function AppContent() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #fff0f5 0%, #fffacd 50%, #ffffff 100%)' }}>
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🐰</div>
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  // 未登录 → 登录页面（整页）
  if (!user) {
    return <LoginPage />
  }

  // 已登录 → 完整应用
  return (
    <SpaceProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-space-bg grid-bg text-space-text">
          {/* 顶部导航栏 */}
          <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 bg-space-bg/80 backdrop-blur border-b border-white/5">
            <div className="text-lg font-bold tracking-tight">认知空间</div>
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full border-2 border-pink-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-yellow-300 flex items-center justify-center text-white text-sm font-bold">
                  {user.username[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm text-white/90 hidden sm:inline">{user.username}</span>
              <button
                onClick={logout}
                className="text-xs px-3 py-1.5 rounded-full border border-white/30 text-white/80 hover:bg-white/10 transition"
              >
                退出
              </button>
            </div>
          </header>

          <div className="pt-14">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/space/:spaceId" element={<SpacePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </SpaceProvider>
  )
}

function App() {
  return <AppContent />
}

export default App
