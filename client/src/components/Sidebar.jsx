import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import moment from 'moment'
import toast from 'react-hot-toast'

const Sidebar = ({ isMenuOpen, setIsMenuOpen }) => {
  const {
    chats,
    setSelectedChat,
    theme,
    setTheme,
    user,
    navigate,
    createNewChat,
    axios,
    setChats,
    fetchUsersChats,
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
        setChats(prev => prev.filter(c => c._id !== chatId))
        await fetchUsersChats()
        toast.success(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <aside
      className={`
        h-screen w-72 flex flex-col
        bg-[#0d1117]
        border-r border-[#30363d]
        px-4 py-5
        transition-transform duration-300
        max-md:absolute z-20
        ${!isMenuOpen && 'max-md:-translate-x-full'}
      `}
    >
      {/* Logo */}
      <img
        src={assets.logo_full_dark}
        onClick={() => navigate('/')}
        className="w-40 mb-6 cursor-pointer opacity-90"
      />

      {/* New Chat */}
      <button
        onClick={createNewChat}
        className="
          w-full flex items-center justify-center gap-2
          py-2 mb-6 text-sm
          bg-[#161b22]
          border border-[#30363d]
          rounded-md
          hover:bg-[#1f2937]
          transition
        "
      >
        <span className="text-lg">+</span>
        New Chat
      </button>

      {/* Search */}
      <div className="
        flex items-center gap-2
        px-3 py-2 mb-4
        bg-[#161b22]
        border border-[#30363d]
        rounded-md
      ">
        <img src={assets.search_icon} className="w-4 invert opacity-70" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search chats"
          className="
            bg-transparent text-xs outline-none flex-1
            placeholder-gray-500
          "
        />
      </div>

      {/* Chats */}
      <p className="text-xs text-gray-500 mb-2">RECENT</p>
      <div className="flex-1 overflow-y-auto space-y-1 text-sm">
        {chats
          .filter(chat =>
            chat.messages[0]
              ? chat.messages[0].content.toLowerCase().includes(search.toLowerCase())
              : chat.name.toLowerCase().includes(search.toLowerCase())
          )
          .map(chat => (
            <div
              key={chat._id}
              onClick={() => {
                navigate('/')
                setSelectedChat(chat)
                setIsMenuOpen(false)
              }}
              className="
                group px-3 py-2 rounded-md
                hover:bg-[#161b22]
                cursor-pointer
                flex justify-between items-start
              "
            >
              <div className="flex-1">
                <p className="truncate text-gray-200">
                  {chat.messages.length
                    ? chat.messages[0].content.slice(0, 32)
                    : chat.name}
                </p>
                <p className="text-xs text-gray-500">
                  {moment(chat.updatedAt).fromNow()}
                </p>
              </div>

              <img
                src={assets.bin_icon}
                onClick={e =>
                  toast.promise(deleteChat(e, chat._id), {
                    loading: 'Deleting…'
                  })
                }
                className="
                  w-4 mt-1 opacity-0
                  group-hover:opacity-70
                  hover:opacity-100
                  invert cursor-pointer
                "
              />
            </div>
          ))}
      </div>

      {/* Quick Links */}
      <div className="space-y-2 mt-4">
        <SidebarItem
          icon={assets.gallery_icon}
          label="Community Images"
          onClick={() => navigate('/community')}
        />
        <SidebarItem
          icon={assets.diamond_icon}
          label={`Credits: ${user?.credits ?? 0}`}
          sub="Buy more credits"
          onClick={() => navigate('/credits')}
        />
      </div>

      {/* Theme Toggle */}
      <div className="
        mt-4 flex items-center justify-between
        px-3 py-2
        bg-[#161b22]
        border border-[#30363d]
        rounded-md
      ">
        <span className="text-sm text-gray-300">Dark mode</span>
        <input
          type="checkbox"
          checked={theme === 'dark'}
          onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="accent-[#7aa2f7]"
        />
      </div>

      {/* User */}
      <div className="
        mt-4 flex items-center gap-3
        px-3 py-2
        bg-[#161b22]
        border border-[#30363d]
        rounded-md
      ">
        <img src={assets.user_icon} className="w-7 rounded-full" />
        <p className="flex-1 text-sm truncate">
          {user ? user.name : 'Login'}
        </p>
        {user && (
          <img
            src={assets.logout_icon}
            onClick={logout}
            className="w-4 invert opacity-70 hover:opacity-100 cursor-pointer"
          />
        )}
      </div>

      {/* Mobile close */}
      <img
        src={assets.close_icon}
        onClick={() => setIsMenuOpen(false)}
        className="w-5 invert absolute top-4 right-4 md:hidden"
      />
    </aside>
  )
}

const SidebarItem = ({ icon, label, sub, onClick }) => (
  <div
    onClick={onClick}
    className="
      flex items-center gap-3
      px-3 py-2
      bg-[#161b22]
      border border-[#30363d]
      rounded-md
      cursor-pointer
      hover:bg-[#1f2937]
    "
  >
    <img src={icon} className="w-4 invert opacity-80" />
    <div className="text-sm">
      <p>{label}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  </div>
)

export default Sidebar
