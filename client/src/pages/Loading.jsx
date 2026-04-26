import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'

const Loading = () => {
  const navigate = useNavigate()
  const { fetchUser } = useAppContext()

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchUser()
      navigate('/')
    }, 8000)

    return () => clearTimeout(timeout)
  }, [fetchUser, navigate])

  return (
    <div className="
      h-screen w-screen
      flex flex-col items-center justify-center
      bg-bg relative overflow-hidden
      text-text
    ">
      {/* Aesthetic Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 blur-[120px] rounded-full -z-10" />

      {/* Modern Spinner Container */}
      <div className="relative mb-8">
        <div className="w-16 h-16 border-4 border-accent-soft border-t-accent rounded-full animate-spin shadow-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-accent rounded-full animate-ping" />
        </div>
      </div>

      {/* Progress Text */}
      <div className="text-center animate-pulse">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-accent mb-2">
          Prompto v2.0
        </p>
        <p className="text-[11px] text-muted font-black uppercase tracking-widest opacity-60">
          Initializing secure environment…
        </p>
      </div>
    </div>
  )
}

export default Loading
