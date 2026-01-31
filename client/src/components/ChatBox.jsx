import React, { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import Message from './Message'
import toast from 'react-hot-toast'

const ChatBox = () => {
  const containerRef = useRef(null)
  const { selectedChat, user, axios, token, setUser } = useAppContext()

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

      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt, timestamp: Date.now(), isImage: false }
      ])

      const { data } = await axios.post(
        `/api/message/${mode}`,
        { chatId: selectedChat._id, prompt, isPublished },
        { headers: { Authorization: token } }
      )

      if (data.success) {
        setMessages(prev => [...prev, data.reply])
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
    if (selectedChat) setMessages(selectedChat.messages)
  }, [selectedChat])

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }, [messages])

  return (
    <div className="flex-1 flex flex-col h-full px-4 md:px-8 xl:px-16 bg-[#0d1117] text-gray-200">

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto py-6 space-y-4 scrollbar-thin scrollbar-thumb-[#30363d]"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
            <img src={assets.logo_full_dark} className="w-48 mb-6" />
            <p className="text-3xl md:text-4xl font-medium tracking-tight">
              Ask anything. Build faster.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Powered for developers.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <Message key={i} message={m} />
        ))}

        {loading && (
          <div className="flex gap-2 px-4 py-2">
            <span className="w-2 h-2 bg-[#7aa2f7] rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-[#7aa2f7] rounded-full animate-bounce delay-150" />
            <span className="w-2 h-2 bg-[#7aa2f7] rounded-full animate-bounce delay-300" />
          </div>
        )}
      </div>

      {/* Image publish toggle */}
      {mode === 'image' && (
        <label className="flex items-center gap-2 text-xs text-gray-400 mb-3 px-2">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={e => setIsPublished(e.target.checked)}
            className="accent-[#7aa2f7]"
          />
          Publish generated image to community
        </label>
      )}

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-3 p-3 mb-4 rounded-xl
                   bg-[#161b22] border border-[#30363d]"
      >
        <select
          value={mode}
          onChange={e => setMode(e.target.value)}
          className="bg-transparent text-sm outline-none text-gray-300"
        >
          <option value="text">Text</option>
          <option value="image">Image</option>
        </select>

        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="> Ask something…"
          className="flex-1 bg-transparent text-sm outline-none placeholder-gray-500"
          required
        />

        <button disabled={loading} className="opacity-90 hover:opacity-100">
          <img
            src={loading ? assets.stop_icon : assets.send_icon}
            className="w-7"
          />
        </button>
      </form>
    </div>
  )
}

export default ChatBox
