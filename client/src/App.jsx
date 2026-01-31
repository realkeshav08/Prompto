import React, { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import Sidebar from './components/SideBar'
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
    <div className="h-screen w-screen bg-[#0d1117] text-gray-200 overflow-hidden">
      <Toaster />

      {/* Mobile menu button */}
      {user && !isMenuOpen && (
        <img
          src={assets.menu_icon}
          onClick={() => setIsMenuOpen(true)}
          className="
            md:hidden
            absolute top-3 left-3 z-30
            w-7 h-7
            cursor-pointer
            invert opacity-80
          "
          alt="menu"
        />
      )}

      {user ? (
        <div className="flex h-full w-full">
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
        <Login />
      )}
    </div>
  )
}

export default App
