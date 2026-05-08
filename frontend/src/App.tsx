import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SpaceProvider } from './store/SpaceContext'
import { useAuth } from './auth/useAuth'
import AuthModal from './auth/AuthModal'
import LandingPage from './components/LandingPage'
import SpacePage from './components/SpacePage'

function AuthButton() {
  const { user, logout } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {user.username[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-sm text-white/90 hidden sm:inline">{user.username}</span>
        <button
          onClick={logout}
          className="text-xs px-3 py-1 rounded-full border border-white/30 text-white/80 hover:bg-white/10 transition"
        >
          退出
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="text-sm px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition"
      >
        登录 / 注册
      </button>
      <AuthModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}

function App() {
  return (
    <SpaceProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-space-bg grid-bg text-space-text">
          <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 bg-space-bg/80 backdrop-blur border-b border-white/5">
            <div className="text-lg font-bold tracking-tight">认知空间</div>
            <AuthButton />
          </header>
          <div className="pt-14">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/space/:spaceId" element={<SpacePage />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </SpaceProvider>
  )
}

export default App
