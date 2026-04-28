import React, { useMemo } from 'react'
import { useAppContext } from '../context'

const Loading = ({ minimal = false, isSyncing = false }) => {
  const { user } = useAppContext()

  const quotes = useMemo(() => [
    "Logic will get you from A to B. Imagination will take you everywhere.",
    "First, solve the problem. Then, write the code.",
    "The only way to do great work is to love what you do.",
    "Code is like humor. When you have to explain it, it’s bad.",
    "Experience is the name everyone gives to their mistakes.",
    "Simplicity is the soul of efficiency.",
    "Optimism is a happiness magnet."
  ], [])

  const quote = useMemo(() => quotes[Math.floor(Math.random() * quotes.length)], [quotes])

  return (
    <div className="
      h-screen w-screen
      flex flex-col items-center justify-center
      bg-bg relative overflow-hidden
      text-text z-[100]
    ">
      {/* Aesthetic Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 blur-[120px] rounded-full -z-10 animate-pulse" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 blur-[100px] rounded-full -z-10" />

      {/* Modern Spinner / Logo Container */}
      {(minimal || isSyncing || !user) && (
        <div className="relative mb-10 scale-125 animate-fade-in">
          <div className="w-16 h-16 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/logo.png" className="w-6 opacity-40 animate-pulse" alt="" />
          </div>
        </div>
      )}

      {/* Dynamic Welcome Text Area */}
      <div className="text-center max-w-lg px-8">
        {!minimal && (
          <p className="text-xs font-black uppercase tracking-[0.4em] text-accent mb-6 animate-fade-in">
            Prompto v2.0
          </p>
        )}
        
        {isSyncing ? (
          // Neutral state while fetching user from token
          <div className="animate-pulse">
            <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60">
              Synchronizing Secure Session...
            </p>
          </div>
        ) : minimal ? (
          // Navigation / Refresh (1 second)
          <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60 animate-pulse">
            Loading your environment...
          </p>
        ) : user ? (
          // Initial Welcome (2 seconds)
          <div className="space-y-6 animate-slide-up">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text leading-tight">
              Welcome back, <br/>
              <span className="text-gradient underline decoration-accent/20 underline-offset-8 decoration-2">{user.name.split(' ')[0]}</span>
            </h1>
            <div className="h-px w-12 bg-accent/30 mx-auto" />
            <p className="text-base text-muted font-medium italic leading-relaxed opacity-80 max-w-sm mx-auto">
              "{quote}"
            </p>
          </div>
        ) : (
          // Guest Visit (2 seconds)
          <div className="animate-pulse space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Initializing Neural Workspace
            </h1>
            <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60">
              Establishing guest connection...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Loading
