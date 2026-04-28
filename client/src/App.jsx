import React, { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import Sidebar from './components/Sidebar'
import ChatBox from './components/ChatBox'
import Credits from './pages/Credits'
import Community from './pages/Community'
import Loading from './pages/Loading'
import Login from './pages/Login'

import { useAppContext } from './context'
import { assets } from './assets/assets'
import './assets/prism.css'

const App = () => {
  const { user, loadingUser, token } = useAppContext()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { pathname } = useLocation()
  
  // Splash states
  const [showSplash, setShowSplash] = useState(true)
  const [isMinimal, setIsMinimal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // 🛡️ LOGIC: Manage the initial "Entry Sequence" (Sync -> Welcome or Guest)
  React.useEffect(() => {
    // 1. Still Bootstrapping User
    if (loadingUser && token) {
      setIsSyncing(true)
      setShowSplash(true)
      return;
    }

    const hasWelcomed = sessionStorage.getItem('hasWelcomed');

    // 2. Handle GUEST (No token, or finished loading and no user)
    if (!token || (!loadingUser && !user)) {
      setIsMinimal(false)
      setIsSyncing(false)
      const timer = setTimeout(() => setShowSplash(false), 2000)
      return () => clearTimeout(timer)
    }

    // 3. Handle AUTHENTICATED USER
    if (user && !loadingUser) {
      if (!hasWelcomed) {
        // Enforce the 1s Phase 1 (Syncing)
        setIsSyncing(true)
        const phase1 = setTimeout(() => {
          setIsSyncing(false)
          setIsMinimal(false)
          // Then the 2s Phase 2 (Welcome)
          const phase2 = setTimeout(() => {
            setShowSplash(false)
            sessionStorage.setItem('hasWelcomed', 'true')
          }, 2000)
          return () => clearTimeout(phase2)
        }, 1000)
        return () => clearTimeout(phase1)
      } else {
        // Already welcomed in this session, handle as 1s refresh splash
        setIsMinimal(true)
        setIsSyncing(false)
        const timer = setTimeout(() => setShowSplash(false), 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [user, loadingUser, token])

  // 🛡️ LOGIC: Manage "Navigation Transitions"
  const prevPath = React.useRef(pathname)
  React.useEffect(() => {
    // Only trigger if the path actually changed AND we've already done the welcome
    if (pathname !== prevPath.current && sessionStorage.getItem('hasWelcomed')) {
      prevPath.current = pathname
      setIsMinimal(true)
      setShowSplash(true)
      const timer = setTimeout(() => setShowSplash(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [pathname])

  // Global loading gate
  if (showSplash || (loadingUser && token)) {
    return <Loading minimal={isMinimal} isSyncing={isSyncing} />
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
