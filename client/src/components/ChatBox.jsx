import React, { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import Message from './Message'
import toast from 'react-hot-toast'

const ChatBox = () => {
  const containerRef = useRef(null)
  const { selectedChat, user, axios, token, setUser, setChats } = useAppContext()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('text')
  const [isPublished, setIsPublished] = useState(false)

  const onSubmit = async (e) => {
    try {
      e.preventDefault()
      if (!user) return toast('Login to send message')

      setLoading(true)
      const promptCopy = prompt
      setPrompt('')

      const userMsg = { role: 'user', content: promptCopy, timestamp: Date.now(), isImage: false }
      setMessages(prev => [...prev, userMsg])

      const { data } = await axios.post(
        `/api/message/${mode}`,
        { chatId: selectedChat._id, prompt: promptCopy, isPublished },
        { headers: { Authorization: token } }
      )

      if (data.success) {
        setTimeout(() => {
          setMessages(prev => [...prev, data.reply])
        }, 0)

        // Sync Sidebar Recent Activity
        setChats(prev => {
          const updated = prev.map(c => {
            if (c._id === selectedChat._id) {
              return {
                ...c,
                messages: [...c.messages, userMsg, data.reply],
                updatedAt: new Date().toISOString()
              }
            }
            return c
          })
          return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        })

        setUser(prev => ({
          ...prev,
          credits: prev.credits - (mode === 'image' ? 2 : 1)
        }))
      } else {
        toast.error(data.message)
        setPrompt(promptCopy)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedChat) {
      const t = setTimeout(() => setMessages(selectedChat.messages), 0)
      return () => clearTimeout(t)
    }
  }, [selectedChat])

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [messages])

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent relative">
      {/* Messages area */}
      <div
        ref={containerRef}
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

        {messages.map((m, i) => (
          <Message key={i} message={m} />
        ))}

        {loading && (
          <div className="flex gap-2 px-6 py-4 glass w-max rounded-2xl ml-4">
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce delay-150" />
            <span className="w-2 h-2 bg-accent rounded-full animate-bounce delay-300" />
          </div>
        )}
      </div>

      {/* Modern Interaction Area */}
      <div className="p-6 md:px-12 xl:px-24">
        {mode === 'image' && (
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
            </select>
          </div>

          <textarea
            value={prompt}
            onChange={e => {
              setPrompt(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            placeholder="Type your prompt here..."
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
            disabled={loading || !prompt.trim()}
            className="
              p-3.5 rounded-full bg-accent text-white shadow-lg
              hover:scale-110 active:scale-90 disabled:opacity-30 disabled:scale-100 disabled:bg-muted/20
              transition-all duration-300 group
            "
          >
            <img
              src={loading ? assets.stop_icon : assets.send_icon}
              className={`w-5 invert dark:invert-0 ${!loading && 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform'}`}
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
