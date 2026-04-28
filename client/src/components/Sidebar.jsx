import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import moment from 'moment'
import toast from 'react-hot-toast'

const Sidebar = ({ isMenuOpen, setIsMenuOpen }) => {
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
    token
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
          const filtered = prev.filter(c => c._id !== chatId)
          if (selectedChat?._id === chatId) {
            setSelectedChat(filtered[0] || null)
          }
          return filtered
        })
        toast.success(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

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
      {/* Brand */}
      <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/')}>
        <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
          <img src={assets.logo} className="w-6" alt="logo" />
        </div>
        <span className="text-xl font-bold tracking-tight text-text">Prompto</span>
      </div>

      {/* New Chat Action */}
      <button
        onClick={createNewChat}
        className="
          w-full flex items-center justify-center gap-3
          py-3 mb-8 text-sm font-bold uppercase tracking-widest
          bg-accent text-white
          rounded-xl 
          shadow-[0_8px_20px_-4px_rgba(79,70,229,0.4)]
          hover:shadow-[0_12px_25px_-4px_rgba(79,70,229,0.5)]
          hover:scale-[1.02] active:scale-95
          transition-all duration-300 group/btn
        "
      >
        <span className="text-xl leading-none group-hover/btn:rotate-90 transition-transform duration-300">+</span>
        New Session
      </button>

      {/* Search Bar */}
      <div className="
        flex items-center gap-3
        px-4 py-2.5 mb-6
        bg-accent-soft border border-accent/10
        rounded-xl
        focus-within:border-accent/40 focus-within:bg-accent-soft transition-all
      ">
        <img src={assets.search_icon} className="w-4 dark:invert opacity-60" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search history"
          className="
            bg-transparent text-sm outline-none flex-1
            placeholder-muted font-bold text-text
          "
        />
      </div>

      {/* Recent History List */}
      <div className="flex items-center justify-between mb-4 px-2">
        <p className="text-[11px] font-bold text-muted tracking-widest uppercase">Recent activity</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 -mr-2 custom-scrollbar">
        {(() => {
          const filteredChats = chats.filter(chat => {
            const searchLower = search.toLowerCase()
            const nameMatch = chat.name.toLowerCase().includes(searchLower)
            const msgMatch = chat.messages.some(m => m.content.toLowerCase().includes(searchLower))
            return nameMatch || msgMatch
          })

          if (chats.length === 0) {
            return (
              <div className="h-40 flex flex-col items-center justify-center text-center px-4 animate-fade-in">
                <div className="w-12 h-12 bg-accent/5 rounded-full flex items-center justify-center mb-4">
                  <img src={assets.logo} className="w-5 opacity-20 invert dark:invert-0" alt="logo" />
                </div>
                <p className="text-[11px] font-bold text-muted uppercase tracking-widest leading-loose">
                  No sessions found<br />
                  <span className="opacity-50 text-[9px]">Start building today</span>
                </p>
              </div>
            )
          }

          if (filteredChats.length === 0) {
            return (
              <div className="py-10 text-center animate-fade-in">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest opacity-60">
                  No results match<br />"{search}"
                </p>
              </div>
            )
          }

          return filteredChats.map(chat => {
            const isActive = selectedChat?._id === chat._id
            const lastMsg = chat.messages[chat.messages.length - 1]
            const previewText = lastMsg ? lastMsg.content : chat.name

            return (
              <div
                key={chat._id}
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
                  border
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
                    truncate text-[13px] font-bold tracking-tight transition-colors
                    ${isActive ? 'text-accent' : 'text-text group-hover:text-accent'}
                  `}>
                    {previewText}
                  </p>
                  <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 opacity-80">
                    {moment(chat.updatedAt).fromNow()}
                  </p>
                </div>

                <button
                  onClick={e => deleteChat(e, chat._id)}
                  className="
                    p-1.5 rounded-lg
                    opacity-0 group-hover:opacity-100
                    hover:bg-red-500/10
                    transition-all duration-300
                  "
                >
                  <img src={assets.bin_icon} className="w-3.5 dark:invert opacity-30 hover:opacity-100" />
                </button>
              </div>
            )
          })
        })()}
      </div>

      {/* Footer Navigation */}
      <div className="mt-8 pt-8 border-t border-border/50 space-y-3">
        <SidebarItem
          icon={assets.gallery_icon}
          label="Showcase"
          onClick={() => navigate('/community')}
        />
        <SidebarItem
          icon={assets.diamond_icon}
          label="Pro Access"
          sub={`${user?.credits ?? 0} Credits remaining`}
          onClick={() => navigate('/credits')}
        />
      </div>

      {/* System Theme Controls */}
      <div className="
        mt-6 flex items-center justify-between
        px-4 py-3
        bg-accent-soft/50
        rounded-2xl
        border border-accent/5
      ">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/80">Interface</span>
          <span className="text-xs text-text font-extrabold tracking-tight">Dark Mode</span>
        </div>
        <div
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={`
            w-10 h-5.5 rounded-full p-1 cursor-pointer transition-all duration-500
            ${theme === 'dark' ? 'bg-accent' : 'bg-muted/30'}
          `}
        >
          <div className={`
            w-3.5 h-3.5 bg-white rounded-full shadow-lg transition-transform duration-500
            ${theme === 'dark' ? 'translate-x-4.5' : 'translate-x-0'}
          `} />
        </div>
      </div>

      {/* User Authentication Profile */}
      <div className="
        mt-6 flex items-center gap-4
        p-4
        bg-panel
        border border-border
        rounded-2xl
        shadow-premium
      ">
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center overflow-hidden border border-accent/10">
          <img src={assets.user_icon} className="w-6 invert dark:invert-0" alt="user" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black truncate text-text tracking-tight">
            {user ? user.name : 'Unknown Dev'}
          </p>
          {user && <p className="text-[9px] text-muted font-black tracking-[0.1em] uppercase opacity-60">Developer Pro</p>}
        </div>
        {user && (
          <button
            onClick={logout}
            className="p-2.5 rounded-xl hover:bg-muted/10 transition-all active:scale-90"
          >
            <img src={assets.logout_icon} className="w-4 invert dark:invert-0 opacity-80 hover:opacity-100" />
          </button>
        )}
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
}

const SidebarItem = ({ icon, label, sub, onClick }) => (
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

export default Sidebar
