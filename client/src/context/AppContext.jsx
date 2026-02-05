/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'

/* ---------------- AXIOS GLOBAL CONFIG ---------------- */

axios.defaults.baseURL = import.meta.env.VITE_SERVER_URL
axios.defaults.withCredentials = true // ⭐ REQUIRED for CORS + cookies

console.log("API URL:", import.meta.env.VITE_SERVER_URL);

/* ---------------- CONTEXT ---------------- */

const AppContext = createContext()

export const AppContextProvider = ({ children }) => {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [chats, setChats] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)

  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'dark'
  )

  const [token, setToken] = useState(
    localStorage.getItem('token')
  )

  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingChats, setLoadingChats] = useState(false)

  /* ---------------- AXIOS INTERCEPTOR ---------------- */

  useEffect(() => {
    const interceptor = axios.interceptors.request.use(config => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      } else {
        delete config.headers.Authorization
      }
      return config
    })

    return () => {
      axios.interceptors.request.eject(interceptor)
    }
  }, [token])

  /* ---------------- USER ---------------- */

  const fetchUser = async () => {
    try {
      setLoadingUser(true)
      const { data } = await axios.get('/api/user/data')

      if (data.success) {
        setUser(data.user)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
      setUser(null)
    } finally {
      setLoadingUser(false)
    }
  }

  /* ---------------- CHATS ---------------- */

  const fetchUsersChats = async () => {
    try {
      setLoadingChats(true)
      const { data } = await axios.get('/api/chat/get')

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (data.chats.length === 0) {
        await createNewChat(true)
        return
      }

      setChats(data.chats)
      setSelectedChat(prev => prev ?? data.chats[0])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoadingChats(false)
    }
  }

  const createNewChat = async (silent = false) => {
    try {
      if (!user) {
        if (!silent) toast('Login to create a new chat')
        return
      }

      const { data } = await axios.get('/api/chat/create')

      if (data.success) {
        setChats(prev => [data.chat, ...prev])
        setSelectedChat(data.chat)
        navigate('/')
        if (!silent) toast.success('New session started')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  /* ---------------- THEME ---------------- */

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  /* ---------------- BOOTSTRAP ---------------- */

  useEffect(() => {
    if (token) {
      fetchUser()
    } else {
      setUser(null)
      setLoadingUser(false)
    }
  }, [token])

  useEffect(() => {
    if (user) {
      fetchUsersChats()
    } else {
      setChats([])
      setSelectedChat(null)
    }
  }, [user])

  /* ---------------- CONTEXT VALUE ---------------- */

  const value = useMemo(() => ({
    navigate,
    user,
    setUser,
    chats,
    setChats,
    selectedChat,
    setSelectedChat,
    theme,
    setTheme,
    token,
    setToken,
    loadingUser,
    loadingChats,
    fetchUser,
    fetchUsersChats,
    createNewChat,
    axios
  }), [
    user,
    chats,
    selectedChat,
    theme,
    token,
    loadingUser,
    loadingChats
  ])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => useContext(AppContext)
