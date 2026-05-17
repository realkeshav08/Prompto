import React, { useMemo } from 'react'
import { useAppContext } from '../context'
import { assets } from '../assets/assets'

const QUOTES = [
  "Logic will get you from A to B. Imagination will take you everywhere.",
  "First, solve the problem. Then, write the code.",
  "The only way to do great work is to love what you do.",
  "Code is like humor. When you have to explain it, it's bad.",
  "Experience is the name everyone gives to their mistakes.",
  "Simplicity is the soul of efficiency.",
  "Optimism is a happiness magnet."
]

// type: 'welcome' (first visit) | 'reload' (page refresh) | 'nav' (section switch)
const Loading = ({ type = 'nav' }) => {
  const { user, loadingUser, token } = useAppContext()
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [])

  // A stored session is still resolving — neutral state until we know the user.
  const syncing = loadingUser && token
  const showWelcome = type === 'welcome' && !syncing

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

      {/* Spinner — shown for every state except the full welcome */}
      {!showWelcome && (
        <div className="relative mb-10 scale-125 animate-fade-in">
          <div className="w-16 h-16 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={assets.logo} className="w-6 opacity-40 animate-pulse" alt="" />
          </div>
        </div>
      )}

      {/* Text Area */}
      <div className="text-center max-w-lg px-8">
        {showWelcome && (
          <p className="text-xs font-black uppercase tracking-[0.4em] text-accent mb-6 animate-fade-in">
            Prompto v2.0
          </p>
        )}

        {syncing ? (
          // Resolving a stored token
          <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60 animate-pulse">
            Synchronizing Secure Session...
          </p>
        ) : type === 'welcome' ? (
          user ? (
            // First visit — authenticated
            <div className="space-y-6 animate-slide-up">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text leading-tight">
                Welcome back, <br />
                <span className="text-gradient underline decoration-accent/20 underline-offset-8 decoration-2">
                  {user.name.split(' ')[0]}
                </span>
              </h1>
              <div className="h-px w-12 bg-accent/30 mx-auto" />
              <p className="text-base text-muted font-medium italic leading-relaxed opacity-80 max-w-sm mx-auto">
                "{quote}"
              </p>
            </div>
          ) : (
            // First visit — guest
            <div className="space-y-6 animate-slide-up">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-text leading-tight">
                Welcome to <span className="text-gradient">Prompto</span>
              </h1>
              <div className="h-px w-12 bg-accent/30 mx-auto" />
              <p className="text-base text-muted font-medium italic leading-relaxed opacity-80 max-w-sm mx-auto">
                "{quote}"
              </p>
            </div>
          )
        ) : type === 'reload' ? (
          // Page refresh
          <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60 animate-pulse">
            Reloading your workspace...
          </p>
        ) : (
          // Section switch / generic
          <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60 animate-pulse">
            Loading...
          </p>
        )}
      </div>
    </div>
  )
}

export default Loading
