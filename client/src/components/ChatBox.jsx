import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context'
import { assets } from '../assets/assets'
import Message from './Message'
import DocumentUpload from './DocumentUpload'
import toast from 'react-hot-toast'

// True when the document was loaded via a hard browser reload.
// Module-scoped so it survives ChatBox remounts but is consumed only once
// per page load (see the scroll effect below).
let pendingReloadScroll = (() => {
  try {
    return performance.getEntriesByType('navigation')[0]?.type === 'reload'
  } catch {
    return false
  }
})()

const ChatBox = () => {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const { selectedChat, setSelectedChat, user, axios, setUser, setChats } = useAppContext()

  const [messages, setMessages] = useState([])
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('text')
  const [ragMode, setRagMode] = useState('hybrid')
  const [isPublished, setIsPublished] = useState(false)
  const [loadingChatId, setLoadingChatId] = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  // The server generates a clean AI title for the first exchange in the
  // background; pull it in and swap it into the sidebar once it's ready.
  const refreshChatTitle = async (chatId) => {
    try {
      const { data } = await axios.get(`/api/chat/${chatId}`)
      const newName = data?.chat?.name
      if (data?.success && newName) {
        setChats(prev => prev.map(c => (c._id === chatId ? { ...c, name: newName } : c)))
        setSelectedChat(prev => (prev?._id === chatId ? { ...prev, name: newName } : prev))
      }
    } catch {
      // Non-fatal — the title will sync on the next chat list load.
    }
  }

  // Core send routine — shared by the input form and the resend button.
  const sendPrompt = async ({ chatId, text, sendMode, sendRagMode, sendIsPublished }) => {
    setLoadingChatId(chatId)

    // First exchange = no AI reply exists in this chat yet.
    const isFirstMessage = !messages.some(m => m.role === 'assistant')

    const userMsg = { role: 'user', content: text, timestamp: Date.now(), isImage: false }

    // Optimistically show the message + update the sidebar.
    setMessages(prev => [...prev, userMsg])
    setChats(prev => {
      const updated = prev.map(c => {
        if (c._id === chatId) {
          const chatName = (c.name === 'New Chat' || c.name === 'New Session' || c.messages.length === 0)
            ? (text.length > 40 ? text.substring(0, 40) + '...' : text)
            : c.name
          return { ...c, name: chatName, messages: [...c.messages, userMsg], updatedAt: new Date().toISOString() }
        }
        return c
      })
      return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    })

    // Flag the optimistic message as failed so a Resend button appears,
    // and roll it back out of the sidebar (it was never saved server-side).
    const markFailed = () => {
      setMessages(prev => prev.map(m =>
        m.timestamp === userMsg.timestamp && m.role === 'user'
          ? { ...m, failed: true, retry: { sendMode, sendRagMode, sendIsPublished } }
          : m
      ))
      setChats(prev => prev.map(c =>
        c._id === chatId
          ? { ...c, messages: c.messages.filter(m => m.timestamp !== userMsg.timestamp || m.role !== 'user') }
          : c
      ))
    }

    try {
      const endpoint = sendMode === 'study' ? '/api/message/rag' : `/api/message/${sendMode}`
      const payload = sendMode === 'study'
        ? { chatId, prompt: text, ragMode: sendRagMode }
        : { chatId, prompt: text, isPublished: sendIsPublished }

      // Generous timeout — image generation and a cold AI service can run long.
      const { data } = await axios.post(endpoint, payload, { timeout: 180000 })

      if (data.success) {
        setMessages(prev => [...prev, data.reply])

        setChats(prev => {
          const updated = prev.map(c => {
            if (c._id === chatId) {
              return {
                ...c,
                messages: [...c.messages.filter(m => m.timestamp !== userMsg.timestamp || m.role !== 'user'), userMsg, data.reply],
                updatedAt: new Date().toISOString()
              }
            }
            return c
          })
          return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        })

        setUser(prev => ({
          ...prev,
          // video 4 · image 2 · study 2 · text 1
          credits: prev.credits - (sendMode === 'video' ? 4 : sendMode === 'image' ? 2 : sendMode === 'study' ? 2 : 1)
        }))

        // First exchange — the server generates a clean AI title in the
        // background; pull it in once ready (text & study modes only).
        if (isFirstMessage && (sendMode === 'text' || sendMode === 'study')) {
          setTimeout(() => refreshChatTitle(chatId), 3000)
          setTimeout(() => refreshChatTitle(chatId), 7000)
        }
      } else {
        toast.error(data.message)
        markFailed()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
      markFailed()

      // If insufficient credits, redirect to the pricing/credits page.
      // skipSplash → App skips the 1s loading splash for this redirect.
      if (err.response?.status === 403) {
        setTimeout(() => navigate('/credits', { state: { skipSplash: true } }), 1500)
      }
    } finally {
      setLoadingChatId(null)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (loadingChatId !== null) return
    if (!user) return toast('Login to send message')
    if (!selectedChat) return toast.error('No active session. Please start a new session.')
    if (!prompt.trim()) return

    if (mode === 'video') {
      return toast('🎬 Video generation is an upcoming feature — coming soon!')
    }

    const text = prompt.trim()
    setPrompt('')
    sendPrompt({
      chatId: selectedChat._id,
      text,
      sendMode: mode,
      sendRagMode: ragMode,
      sendIsPublished: isPublished,
    })
  }

  // Retry a message that failed to send, using the mode it was sent with.
  const resendMessage = (failedMsg) => {
    if (loadingChatId !== null) return
    if (!selectedChat) return

    // Drop the failed bubble; sendPrompt re-adds a fresh optimistic one.
    setMessages(prev => prev.filter(m => m.timestamp !== failedMsg.timestamp))

    const r = failedMsg.retry || {}
    sendPrompt({
      chatId: selectedChat._id,
      text: failedMsg.content,
      sendMode: r.sendMode || 'text',
      sendRagMode: r.sendRagMode || 'hybrid',
      sendIsPublished: r.sendIsPublished || false,
    })
  }

  // Load a chat's messages only when the chat ID actually changes (a real
  // chat switch) — NOT when the same chat's object reference changes, e.g.
  // when the background auto-title updates selectedChat. Otherwise the live
  // conversation gets wiped and it looks like a new chat opened.
  useEffect(() => {
    if (selectedChat) {
      setMessages(selectedChat.messages || [])
    }
  }, [selectedChat?._id])

  // Remember where the user is scrolled within the current chat.
  const handleScroll = () => {
    const c = containerRef.current
    if (c && selectedChat?._id) {
      sessionStorage.setItem('promptoScroll:' + selectedChat._id, String(c.scrollTop))
    }
  }

  useEffect(() => {
    const c = containerRef.current
    if (!c) return

    // On a page reload while inside the chat, restore the exact scroll
    // position the user was at (the question/answer they were viewing).
    if (pendingReloadScroll && messages.length > 0) {
      pendingReloadScroll = false
      const saved = selectedChat?._id
        ? sessionStorage.getItem('promptoScroll:' + selectedChat._id)
        : null
      if (saved !== null) {
        const prev = c.style.scrollBehavior
        c.style.scrollBehavior = 'auto'
        c.scrollTop = Number(saved)
        c.style.scrollBehavior = prev
        return
      }
    }

    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent relative">
      <DocumentUpload isOpen={showUpload} onClose={() => setShowUpload(false)} />
      {/* Chat Header */}
      <div className="flex-none px-6 py-4 border-b border-border/50 flex items-center justify-between glass z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <img src={assets.logo} className="w-5 opacity-40" alt="icon" />
          </div>
          <h2 className="text-sm font-bold text-text truncate max-w-[200px] md:max-w-md">
            {selectedChat?.name || 'New Session'}
          </h2>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 md:px-12 xl:px-32 py-10 space-y-8 scroll-smooth custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in max-w-4xl mx-auto">
            <div className="relative mb-10">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full" />
              <div className="relative w-24 h-24 flex items-center justify-center">
                <img src={assets.logo} className="w-20 rounded-3xl" alt="logo" />
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-text mb-6 leading-[1.1]">
              What will we <span className="text-accent underline decoration-accent/20 underline-offset-8 italic">build</span> today?
            </h1>

            <p className="text-lg text-muted/80 max-w-xl font-medium leading-relaxed mb-12">
              Transform your ideas into reality with Prompto v2.0. Neural-powered architecture, clean code, and creative logic.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full px-4">
              <PromptCard
                text="Design a clean React utility hook for storage"
                onClick={() => setPrompt("Write a clean React hook for a debounced locale storage value")}
              />
              <PromptCard
                text="Concept for a glassmorphism landing page"
                onClick={() => setPrompt("Generate a modern CSS glassmorphism concept for a high-end SaaS landing page")}
              />
              <PromptCard
                text="Architect a scalable microservices structure"
                onClick={() => setPrompt("Explain the best practices for architecting a scalable microservices system using Node.js")}
              />
              <PromptCard
                text="Refactor complex logic into clean patterns"
                onClick={() => setPrompt("Show me how to refactor a complex nested conditional logic into a strategy pattern in JS")}
              />
            </div>
          </div>
        )}

        {(messages || []).map((m, i) => (
          <React.Fragment key={i}>
            <Message message={m} />
            {m.failed && (
              <div className="flex justify-end items-center gap-2 -mt-5 pr-1 animate-fade-in">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-500/80">
                  Not delivered
                </span>
                <button
                  onClick={() => resendMessage(m)}
                  disabled={loadingChatId !== null}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 transition-all"
                >
                  ↻ Resend
                </button>
              </div>
            )}
          </React.Fragment>
        ))}

        {loadingChatId === selectedChat?._id && (
          <div className="flex gap-2 px-6 py-4 glass w-max rounded-2xl ml-4">
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce delay-150" />
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce delay-300" />
          </div>
        )}
      </div>

      {/* Modern Interaction Area */}
      <div className="p-6 md:px-12 xl:px-24">
        {(mode === 'image' || mode === 'video') && (
          <label className="flex items-center gap-3 text-[11px] font-bold text-muted mb-4 px-4 uppercase tracking-widest">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={e => setIsPublished(e.target.checked)}
              className="accent-accent w-4 h-4 rounded-md"
            />
            Feature in community collection
          </label>
        )}

        {mode === 'study' && (
          <div className="flex items-center gap-3 mb-4 px-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Source:</span>
            {['notes', 'global', 'hybrid'].map(m => (
              <button
                key={m}
                onClick={() => setRagMode(m)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                  ragMode === m
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface/40 text-muted hover:text-text'
                }`}
              >
                {m === 'notes' ? '📝 My Notes' : m === 'global' ? '🌐 Global' : '⚡ Hybrid'}
              </button>
            ))}
            <button
              onClick={() => setShowUpload(true)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 text-accent text-[11px] font-bold hover:bg-accent/20 transition-all"
            >
              📂 Manage Docs
            </button>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="
            relative flex items-end gap-3 p-2.5 
            glass rounded-[2rem] shadow-premium
            focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/5
            transition-all duration-300
          "
        >
          <div className="relative group">
            <select
              value={mode}
              onChange={e => setMode(e.target.value)}
              className="
                appearance-none bg-accent-soft/50 text-[11px] font-extrabold uppercase tracking-tighter
                outline-none text-accent px-5 py-3.5 rounded-3xl
                cursor-pointer hover:bg-accent hover:text-white transition-all duration-200
              "
            >
              <option value="text">Chat</option>
              <option value="image">Draw</option>
              <option value="video">Video</option>
              <option value="study">Study AI</option>
            </select>
          </div>

          <textarea
            value={prompt}
            onChange={e => {
              setPrompt(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            placeholder="Type a prompt..."
            className="
              flex-1 bg-transparent px-4 py-3.5 text-sm outline-none 
              placeholder-muted font-medium resize-none max-h-48 custom-scrollbar
            "
            required
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit(e)
              }
            }}
          />

          <button
            disabled={loadingChatId !== null || !prompt.trim()}
            className="
              p-3.5 rounded-full bg-accent text-white shadow-lg
              hover:scale-110 active:scale-90 disabled:opacity-30 disabled:scale-100 disabled:bg-muted/20
              transition-all duration-300 group
            "
          >
            <img
              src={loadingChatId !== null ? assets.stop_icon : assets.send_icon}
              className={`w-5 invert dark:invert-0 ${loadingChatId === null && 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform'}`}
              alt="action"
            />
          </button>
        </form>
        <p className="text-[10px] text-center mt-3 text-muted font-bold uppercase tracking-[0.2em] opacity-80">
          Powered by Prompto v2.0 • Advanced Agentic Reasoning
        </p>
      </div>
    </div>
  )
}

const PromptCard = ({ text, onClick }) => (
  <div
    onClick={onClick}
    className="
      p-5 glass rounded-2xl text-left
      cursor-pointer group/card
      transition-all duration-300
      hover:border-accent/30 hover:bg-accent/[0.02]
      flex items-center gap-4
    "
  >
    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold group-hover/card:bg-accent group-hover/card:text-white transition-all">
      <span className="text-xs">→</span>
    </div>
    <span className="text-sm font-semibold text-muted group-hover/card:text-text transition-colors leading-tight">
      {text}
    </span>
  </div>
)

export default ChatBox
