import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SpaceProvider } from './store/SpaceContext'
import LandingPage from './components/LandingPage'
import SpacePage from './components/SpacePage'

function App() {
  return (
    <SpaceProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-space-bg grid-bg text-space-text">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/space/:spaceId" element={<SpacePage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </SpaceProvider>
  )
}

export default App
