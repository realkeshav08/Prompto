import React, { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import Sidebar from './components/Sidebar'
import ChatBox from './components/ChatBox'
import Credits from './pages/Credits'
import Community from './pages/Community'
import Loading from './pages/Loading'
import Login from './pages/Login'

import { useAppContext } from './context/AppContext'
import { assets } from './assets/assets'
import './assets/prism.css'

const App = () => {
  const { user, loadingUser } = useAppContext()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // Global loading gate
  if (pathname === '/loading' || loadingUser) {
    return <Loading />
  }

  return (
    <div className="h-screen w-screen bg-bg text-text overflow-hidden relative">
      <Toaster />

      {/* Global Background Decorations */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] -z-10 -translate-x-1/2 translate-y-1/2 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-accent/[0.02] rounded-full blur-[150px] -z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      {/* Mobile menu button */}
      {user && !isMenuOpen && (
        <img
          src={assets.menu_icon}
          onClick={() => setIsMenuOpen(true)}
          className="
            md:hidden
            absolute top-6 left-6 z-30
            w-8 h-8
            cursor-pointer
            invert dark:invert-0 opacity-80 hover:opacity-100 transition-opacity
          "
          alt="menu"
        />
      )}

      {user ? (
        <div className="flex h-full w-full relative z-10">
          <Sidebar
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
          />

          <main className="flex-1 h-full overflow-hidden">
            <Routes>
              <Route path="/" element={<ChatBox />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/community" element={<Community />} />
            </Routes>
          </main>
        </div>
      ) : (
        <div className="h-full w-full relative z-10 flex items-center justify-center">
          <Login />
        </div>
      )}
    </div>
  )
}

export default App
