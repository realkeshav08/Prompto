import React, { useState, useRef, useEffect } from 'react'
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

// Landing target for Stripe's success_url after a completed payment.
// Refreshes the user (so new credits show) then routes to the Credits page.
const PaymentReturn = () => {
  const { fetchUser, navigate } = useAppContext()

  useEffect(() => {
    // Refresh credits SILENTLY (no loadingUser toggle → no splash-gate loop),
    // giving the Stripe webhook a moment to land, then go to the Credits page.
    const refresh = setTimeout(() => fetchUser({ silent: true }), 1500)
    const go = setTimeout(() => navigate('/credits'), 3000)
    return () => { clearTimeout(refresh); clearTimeout(go) }
  }, [fetchUser, navigate])

  return <Loading type="nav" />
}

const App = () => {
  const { user, loadingUser, token } = useAppContext()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()
  const { pathname } = location

  // Splash overlay:
  //   'welcome' — first visit this browser session (1.5s)
  //   'reload'  — page refresh (1s)
  //   'nav'     — in-app section switch (1s)
  const [splash, setSplash] = useState(() =>
    sessionStorage.getItem('promptoVisited') ? 'reload' : 'welcome'
  )

  // Initial page load — time the welcome / reload splash.
  useEffect(() => {
    if (splash !== 'welcome' && splash !== 'reload') return
    // Hold the splash until a stored session finishes resolving, so the
    // welcome can greet the user by name.
    if (loadingUser && token) return

    sessionStorage.setItem('promptoVisited', '1')
    const duration = splash === 'welcome' ? 1500 : 1000
    const t = setTimeout(() => setSplash(null), duration)
    return () => clearTimeout(t)
  }, [splash, loadingUser, token])

  // In-app section switches — brief 1s loading splash.
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (pathname === prevPath.current) return
    prevPath.current = pathname
    // Some navigations opt out of the splash (e.g. the out-of-credits redirect).
    if (location.state?.skipSplash) return
    setSplash('nav')
    const t = setTimeout(() => setSplash(null), 1000)
    return () => clearTimeout(t)
  }, [pathname, location.state])

  // Global loading gate
  if (splash || (loadingUser && token)) {
    return <Loading type={splash || 'reload'} />
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
            absolute top-6 right-6 z-30
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
              <Route path="/loading" element={<PaymentReturn />} />
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
