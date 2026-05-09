import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SpaceProvider } from './store/SpaceContext'
import { useAuth } from './auth/useAuth'
import LoginPage from './auth/LoginPage'
import LandingPage from './components/LandingPage'
import SpacePage from './components/SpacePage'

function AppContent() {
  const { user, loading } = useAuth()

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
          <div>
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
