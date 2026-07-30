import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import ChatBox from './components/ChatBox'
import Skeleton from './components/Skeleton'
import Login from './pages/Login'

import { useAppContext } from './context'
import { assets } from './assets/assets'
import './assets/prism.css'

// Route-level code splitting: the Credits and Community pages (and their heavy
// dependencies) load only when first visited, shrinking the initial bundle.
const Credits = lazy(() => import('./pages/Credits'))
const Community = lazy(() => import('./pages/Community'))

// Landing target for Stripe's success_url after a completed payment.
// Refreshes the user (so new credits show) then routes to the Credits page.
const PaymentReturn = () => {
  const { fetchUser, navigate } = useAppContext()

  useEffect(() => {
    // Refresh credits SILENTLY, giving the Stripe webhook a moment to land,
    // then go to the Credits page.
    const refresh = setTimeout(() => fetchUser({ silent: true }), 1500)
    const go = setTimeout(() => navigate('/credits'), 3000)
    return () => { clearTimeout(refresh); clearTimeout(go) }
  }, [fetchUser, navigate])

  return <Skeleton variant="content" />
}

const App = () => {
  const { user, loadingUser, authed } = useAppContext()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // A stored session is still resolving (authed flag set, user not fetched yet):
  // show the app-shell skeleton instead of a blank screen. If the cookie turns
  // out to be invalid, the 401 handler flips `authed` off and we fall through to
  // <Login /> below.
  if (!user && authed && loadingUser) {
    return <Skeleton />
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
          <ErrorBoundary fallback={<div className="w-80 bg-red-900/10 p-10">Sidebar Error</div>}>
            <Sidebar
              isMenuOpen={isMenuOpen}
              setIsMenuOpen={setIsMenuOpen}
            />
          </ErrorBoundary>

          <main className="flex-1 h-full overflow-hidden">
            <Suspense fallback={<Skeleton variant="content" />}>
              <Routes>
                <Route path="/" element={<ChatBox />} />
                <Route path="/credits" element={<Credits />} />
                <Route path="/community" element={<Community />} />
                <Route path="/loading" element={<PaymentReturn />} />
              </Routes>
            </Suspense>
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
