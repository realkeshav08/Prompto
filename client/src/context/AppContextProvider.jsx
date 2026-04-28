import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { AppContext } from './context'

/* ---------------- AXIOS INSTANCE ---------------- */

const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL,
  withCredentials: true
})

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

  /* ---------------- AXIOS INTERCEPTORS ---------------- */

  useEffect(() => {
    // Request Interceptor
    const reqInterceptor = api.interceptors.request.use(config => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      } else {
        delete config.headers.Authorization
      }
      return config
    })

    // Response Interceptor
    const resInterceptor = api.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          console.warn("🚫 Session expired or invalid");
          setToken(null)
          localStorage.removeItem('token')
          setUser(null)
        }
        return Promise.reject(error)
      }
    )

    return () => {
      api.interceptors.request.eject(reqInterceptor)
      api.interceptors.response.eject(resInterceptor)
    }
  }, [token])

  /* ---------------- USER ---------------- */

  const fetchUser = useCallback(async () => {
    try {
      setLoadingUser(true)
      const { data } = await api.get('/api/user/data')

      if (data.success) {
        setUser(data.user)
      } else {
        toast.error(data.message)
        setUser(null)
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || err.message)
      }
      setUser(null)
    } finally {
      setLoadingUser(false)
    }
  }, [])

  /* ---------------- CHATS ---------------- */

  const createNewChat = useCallback(async (silent = false) => {
    // 🛡️ Guard: If the current chat is already empty, don't create a new one
    if (selectedChat && (!selectedChat.messages || selectedChat.messages.length === 0)) {
      console.log("⚠️ Already on an empty session, skipping creation");
      navigate('/')
      return;
    }

    try {
      if (!user) {
        if (!silent) toast('Login to create a new chat')
        return
      }

      const { data } = await api.get('/api/chat/create')

      if (data.success) {
        setChats(prev => [data.chat, ...prev])
        setSelectedChat(data.chat)
        navigate('/')
        if (!silent) toast.success('New session started')
      }
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || err.message)
      }
    }
  }, [user, navigate, selectedChat])

  const fetchUsersChats = useCallback(async () => {
    try {
      setLoadingChats(true)
      const { data } = await api.get('/api/chat/get')

      if (!data.success) {
        toast.error(data.message)
        return
      }

      if (data.chats.length === 0) {
        await createNewChat(true)
        return
      }

      setChats(data.chats || [])
      // Always start with a new chat upon login/boot as requested
      await createNewChat(true)
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || err.message)
      }
    } finally {
      setLoadingChats(false)
    }
  }, [createNewChat])

  /* ---------------- THEME ---------------- */

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  /* ---------------- BOOTSTRAP ---------------- */

  useEffect(() => {
    if (token) {
      console.log("🔐 Token detected, bootstrapping...");
      fetchUser();
    } else {
      console.log("🚫 No token, reset state");
      setUser(null);
      setChats([]);
      setSelectedChat(null);
      setLoadingUser(false);
    }
  }, [token, fetchUser]);

  useEffect(() => {
    if (user) {
      const hasAutoCreated = sessionStorage.getItem('hasAutoCreatedFirstChat');
      
      if (!hasAutoCreated) {
        console.log("👤 First Login - Creating New Chat");
        sessionStorage.setItem('hasAutoCreatedFirstChat', 'true');
        fetchUsersChats(); // This will trigger createNewChat in its logic
      } else {
        console.log("👤 Refresh/Return - Syncing Chats only");
        // For refreshes, we just fetch chats without forcing a new one
        const syncOnly = async () => {
          try {
            const { data } = await api.get('/api/chat/get')
            if (data.success) {
              setChats(data.chats || [])
              
              // 🛡️ Ensure we always have a selected chat if on home page
              if (data.chats?.length === 0) {
                createNewChat(true);
              } else if (!selectedChat) {
                setSelectedChat(data.chats[0]);
              }
            }
          } catch (err) { console.error(err) }
        }
        syncOnly();
      }
    }
  }, [user, selectedChat]);

  const prevSelectedId = useRef(null);

  useEffect(() => {
    const cleanup = async () => {
      const prevId = prevSelectedId.current;
      // If we switched AWAY from a chat that was empty, delete it
      if (prevId && (!selectedChat || selectedChat._id !== prevId)) {
        const chatToDelete = chats.find(c => c._id === prevId);
        if (chatToDelete && (!chatToDelete.messages || chatToDelete.messages.length === 0)) {
          console.log("🧹 Auto-cleaning empty chat:", prevId);
          try {
            await api.post('/api/chat/delete', { chatId: prevId });
            setChats(prev => prev.filter(c => c._id !== prevId));
          } catch (err) {
            console.error("Cleanup failed:", err);
          }
        }
      }
      prevSelectedId.current = selectedChat?._id;
    };

    cleanup();
  }, [selectedChat, chats]);

  useEffect(() => {
    if (selectedChat && !chats.some(c => c._id === selectedChat._id)) {
      setSelectedChat(null);
    }
  }, [chats, selectedChat]);

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
    axios: api // ⭐ Use the specialized instance
  }), [
    navigate,
    user,
    chats,
    selectedChat,
    theme,
    token,
    loadingUser,
    loadingChats,
    fetchUser,
    fetchUsersChats,
    createNewChat
  ])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}
