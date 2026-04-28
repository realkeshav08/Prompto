import React, { useState } from 'react'
import { useAppContext } from '../context'
import { assets } from '../assets/assets'
import toast from 'react-hot-toast'

function SidebarItem({ icon, label, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      className="
        flex items-center gap-4
        px-5 py-3.5
        rounded-2xl
        cursor-pointer
        transition-all duration-300
        hover:bg-accent-soft
        group
      "
    >
      <div className="w-9 h-9 rounded-xl bg-panel border border-border/60 flex items-center justify-center group-hover:scale-110 group-hover:bg-accent group-hover:border-accent transition-all duration-500 shadow-sm">
        <img src={icon} className="w-4.5 invert dark:invert-0 group-hover:invert-0 transition-all" alt="icon" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-black text-text group-hover:text-accent transition-colors">{label}</p>
        {sub && <p className="text-[9px] text-text/50 font-black uppercase tracking-wider mt-0.5">{sub}</p>}
      </div>
      <span className="ml-auto opacity-0 group-hover:opacity-40 transition-all group-hover:translate-x-1">→</span>
    </div>
  )
}

function Sidebar({ isMenuOpen, setIsMenuOpen }) {
  const {
    chats,
    selectedChat,
    setSelectedChat,
    theme,
    setTheme,
    user,
    navigate,
    createNewChat,
    axios,
    setChats,
    setToken,
    token,
    fetchUsersChats
  } = useAppContext()

  const [search, setSearch] = useState('')

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    toast.success('Logged out')
  }

  const deleteChat = async (e, chatId) => {
    try {
      e.stopPropagation()
      if (!window.confirm('Delete this chat?')) return

      const { data } = await axios.post(
        '/api/chat/delete',
        { chatId },
        { headers: { Authorization: token } }
      )

      if (data.success) {
        setChats(prev => {
          const filtered = (prev || []).filter(c => c?._id !== chatId)
          if (selectedChat?._id === chatId) {
            setSelectedChat(filtered[0] || null)
          }
          return filtered
        })
        toast.success(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    }
  }

  try {
    return (
      <aside
        className={`
          h-screen w-80 flex flex-col
          glass border-r
          px-6 py-8
          transition-all duration-500 ease-in-out
          max-md:fixed max-md:inset-y-0 max-md:left-0 z-50
          ${!isMenuOpen && 'max-md:-translate-x-full'}
        `}
      >
        {/* 1. Header Section (Fixed) */}
        <div className="flex-none">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-6 px-2 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <img src={assets.logo} className="w-8 rounded-lg" alt="logo" />
            </div>
            <span className="text-lg font-bold tracking-tight text-text">Prompto</span>
          </div>

          {/* New Chat Action */}
          <button
            onClick={createNewChat}
            className="
              w-full flex items-center justify-center gap-3
              py-2.5 mb-6 text-xs font-bold uppercase tracking-widest
              bg-accent text-white
              rounded-xl 
              shadow-[0_8px_20px_-4px_rgba(79,70,229,0.4)]
              hover:shadow-[0_12px_25px_-4px_rgba(79,70,229,0.5)]
              hover:scale-[1.02] active:scale-95
              transition-all duration-300 group/btn
            "
          >
            <span className="text-lg leading-none group-hover/btn:rotate-90 transition-transform duration-300">+</span>
            New Session
          </button>

          {/* Search Bar */}
          <div className="
            flex items-center gap-2.5
            px-3.5 py-2 mb-5
            bg-accent-soft border border-accent/10
            rounded-xl
            focus-within:border-accent/40 focus-within:bg-accent-soft transition-all
          ">
            <img src={assets.search_icon} className="w-3.5 dark:invert opacity-60" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search history"
              className="
                bg-transparent text-[13px] outline-none flex-1
                placeholder-muted font-bold text-text
              "
            />
          </div>

          {/* Recent History Header */}
          <div className="flex items-center justify-between mb-3 px-2">
            <p className="text-[10px] font-bold text-muted tracking-widest uppercase">Recent activity</p>
            <button 
              onClick={fetchUsersChats}
              className="p-1 hover:bg-accent/10 rounded-lg transition-all active:rotate-180 duration-500"
              title="Refresh history"
            >
              <img src={assets.logo} className="w-2.5 opacity-30 invert dark:invert-0" alt="refresh" />
            </button>
          </div>
        </div>

      {/* 2. History List (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 -mr-2 custom-scrollbar space-y-3 relative mb-6">
        {chats.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center px-4 animate-fade-in">
            <div className="w-12 h-12 bg-accent/5 rounded-full flex items-center justify-center mb-4">
              <img src={assets.logo} className="w-5 opacity-20 invert dark:invert-0" alt="logo" />
            </div>
            <p className="text-[11px] font-bold text-muted uppercase tracking-widest leading-loose">
              No sessions found<br />
              <span className="opacity-50 text-[9px]">Start building today</span>
            </p>
          </div>
        ) : (
          (() => {
            const searchLower = search.toLowerCase()
            const filtered = chats.filter(chat => {
              if (!chat) return false
              const nameMatch = chat.name?.toLowerCase().includes(searchLower)
              const msgMatch = chat.messages?.some(m => m.content?.toLowerCase().includes(searchLower))
              return nameMatch || msgMatch
            })

            if (filtered.length === 0) {
              return (
                <div className="py-10 text-center animate-fade-in">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest opacity-60">
                    No results match<br />"{search}"
                  </p>
                </div>
              )
            }

            return filtered.map(chat => {
              if (!chat) return null
              console.log("Rendering chat item:", chat._id, chat.name);
              const isActive = selectedChat?._id === chat._id
              const previewText = (chat.name && chat.name !== 'New Chat' && chat.name !== 'New Session' 
                ? chat.name 
                : (chat.messages?.[chat.messages.length - 1]?.content || 'New Session')).trim() || 'Empty Session'

              return (
                <div
                  key={chat._id || Math.random()}
                  onClick={() => {
                    navigate('/')
                    setSelectedChat(chat)
                    setIsMenuOpen(false)
                  }}
                  className={`
                    group relative px-4 py-3.5 rounded-2xl
                    cursor-pointer
                    flex justify-between items-center
                    transition-all duration-300
                    border bg-panel/30
                    ${isActive
                      ? 'bg-accent/[0.08] border-accent/20'
                      : 'border-transparent hover:bg-accent/[0.04] hover:border-accent/10'
                    }
                  `}
                >
                  <div className={`
                    sidebar-indicator 
                    ${isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}
                    group-hover:scale-y-100 group-hover:opacity-100
                  `} />
                  
                  <div className="flex-1 min-w-0 pr-2">
                    <p className={`
                      text-[13px] font-bold tracking-tight transition-colors break-words line-clamp-1
                      ${isActive ? 'text-accent' : 'text-text group-hover:text-accent'}
                    `}>
                      {previewText || 'No Title'}
                    </p>
                    <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 opacity-80">
                      {(() => {
                        try {
                          const date = new Date(chat.updatedAt)
                          return isNaN(date.getTime()) ? '' : date.toLocaleDateString()
                        } catch {
                          return ''
                        }
                      })()}
                    </p>
                  </div>

                  <button
                    onClick={e => deleteChat(e, chat._id)}
                    className="
                      p-1.5 rounded-lg
                      opacity-0 group-hover:opacity-100
                      hover:bg-red-500/10
                      transition-all duration-300
                      z-20
                    "
                  >
                    <img src={assets.bin_icon} className="w-3.5 dark:invert opacity-30 hover:opacity-100" />
                  </button>
                </div>
              )
            })
          })()
        )}
      </div>

      {/* 3. Footer Section (Fixed at Bottom) */}
      <div className="flex-none mt-auto space-y-2.5 pt-3 border-t border-border/50">
        {/* Navigation */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => navigate('/community')}
            className="flex items-center gap-2 p-2 rounded-xl bg-accent-soft hover:bg-accent/10 transition-all border border-accent/5 group"
          >
            <img src={assets.gallery_icon} className="w-3.5 dark:invert opacity-60 group-hover:opacity-100" />
            <span className="text-[10px] font-black uppercase tracking-tight text-text">Gallery</span>
          </button>
          <button 
            onClick={() => navigate('/credits')}
            className="flex items-center gap-2 p-2 rounded-xl bg-accent-soft hover:bg-accent/10 transition-all border border-accent/5 group"
          >
            <img src={assets.diamond_icon} className="w-3.5 dark:invert opacity-60 group-hover:opacity-100" />
            <span className="text-[10px] font-black uppercase tracking-tight text-text">{user?.credits ?? 0} Cr</span>
          </button>
        </div>

        {/* User & Theme Combined Row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2.5 p-2 bg-panel border border-border rounded-xl shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center overflow-hidden">
              <img src={assets.user_icon} className="w-4 invert dark:invert-0" alt="user" />
            </div>
            <p className="text-[11px] font-black truncate text-text flex-1">
              {user ? user.name : 'Guest'}
            </p>
            {user && (
              <button onClick={logout} className="p-1 hover:bg-muted/10 rounded-lg">
                <img src={assets.logout_icon} className="w-3 opacity-60" />
              </button>
            )}
          </div>
          
          <div
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 bg-panel border border-border rounded-xl cursor-pointer hover:bg-accent/5 transition-all"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-accent transition-all ${theme === 'dark' ? 'bg-accent' : 'bg-transparent'}`} />
            </div>
          </div>
        </div>
      </div>

        {/* Mobile Interaction Close */}
        <button
          onClick={() => setIsMenuOpen(false)}
          className="
            md:hidden
            absolute top-8 right-8
            p-3 rounded-2xl bg-accent-soft
          "
        >
          <img src={assets.close_icon} className="w-5 dark:invert" />
        </button>
      </aside>
    )
  } catch (e) {
    console.error("Sidebar critical error:", e)
    return <div className="w-80 bg-red-900/10 p-10">Sidebar Error</div>
  }
}

export default Sidebar
