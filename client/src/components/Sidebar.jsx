import React, { useRef, useState } from 'react'
import { useAppContext } from '../context'
import { assets } from '../assets/assets'
import toast from 'react-hot-toast'
import Settings from './Settings'

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
    token,
    fetchUsersChats
  } = useAppContext()

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const cancelRename = useRef(false)

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

  const startRename = (chat) => {
    setEditingId(chat._id)
    setEditValue(chat.name || '')
  }

  const saveRename = async (chatId) => {
    const newName = editValue.trim()
    setEditingId(null)

    const current = chats.find(c => c._id === chatId)
    if (!newName || newName === current?.name) return

    try {
      const { data } = await axios.post('/api/chat/rename', { chatId, name: newName })
      if (data.success) {
        setChats(prev => prev.map(c => (c._id === chatId ? { ...c, name: data.name } : c)))
        if (selectedChat?._id === chatId) {
          setSelectedChat(prev => (prev ? { ...prev, name: data.name } : prev))
        }
        toast.success('Chat renamed')
      } else {
        toast.error(data.message || 'Rename failed')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rename failed')
    }
  }

  try {
    return (
      <>
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
          <div className="flex items-center gap-3 mb-6 px-2 cursor-pointer group" onClick={createNewChat}>
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
            const query = search.trim().toLowerCase()
            const filtered = chats.filter(chat => {
              if (!chat) return false
              const nameMatch = chat.name?.toLowerCase().includes(query)
              const msgMatch = chat.messages?.some(m => m.content?.toLowerCase().includes(query))
              return nameMatch || msgMatch
            })

            if (filtered.length === 0) {
              return (
                <div className="py-10 text-center animate-fade-in">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest opacity-60">
                    No results match<br />"{search.trim()}"
                  </p>
                </div>
              )
            }

            return filtered.map(chat => {
              if (!chat) return null
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
                      : 'border-transparent hover:bg-accent/10 hover:border-accent/25'
                    }
                  `}
                >
                  <div className={`
                    sidebar-indicator 
                    ${isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}
                    group-hover:scale-y-100 group-hover:opacity-100
                  `} />
                  
                  <div className="flex-1 min-w-0 pr-2">
                    {editingId === chat._id ? (
                      <input
                        value={editValue}
                        autoFocus
                        maxLength={100}
                        onChange={e => setEditValue(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
                          if (e.key === 'Escape') { cancelRename.current = true; e.target.blur() }
                        }}
                        onBlur={() => {
                          if (cancelRename.current) {
                            cancelRename.current = false
                            setEditingId(null)
                            return
                          }
                          saveRename(chat._id)
                        }}
                        className="w-full bg-accent-soft border border-accent/40 rounded-lg px-2 py-1 text-[13px] font-bold text-text outline-none focus:border-accent/70"
                      />
                    ) : (
                      <p className={`
                        text-[13px] font-bold tracking-tight transition-colors break-words line-clamp-1
                        ${isActive ? 'text-accent' : 'text-text group-hover:text-accent'}
                      `}>
                        {previewText || 'No Title'}
                      </p>
                    )}
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

                  {editingId !== chat._id && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
                      <button
                        onClick={e => { e.stopPropagation(); startRename(chat) }}
                        className="p-1.5 rounded-lg bg-panel border border-border shadow-sm text-text/80 hover:text-white hover:bg-accent hover:border-accent transition-all"
                        title="Rename chat"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button
                        onClick={e => deleteChat(e, chat._id)}
                        className="p-1.5 rounded-lg bg-panel border border-border shadow-sm text-red-400 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all"
                        title="Delete chat"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
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
          <button
            onClick={() => setShowSettings(true)}
            className="flex-1 flex items-center gap-2.5 p-2 bg-panel border border-border rounded-xl shadow-sm hover:border-accent/40 hover:bg-accent/5 transition-all group"
            title="Settings"
          >
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center overflow-hidden">
              <img src={assets.user_icon} className="w-4 invert dark:invert-0" alt="user" />
            </div>
            <p className="text-[11px] font-black truncate text-text flex-1 text-left">
              {user ? user.name : 'Guest'}
            </p>
            <svg
              className="w-4 h-4 text-muted group-hover:text-accent group-hover:rotate-45 transition-all duration-300"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
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
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </>
    )
  } catch (e) {
    console.error("Sidebar critical error:", e)
    return <div className="w-80 bg-red-900/10 p-10">Sidebar Error</div>
  }
}

export default Sidebar
