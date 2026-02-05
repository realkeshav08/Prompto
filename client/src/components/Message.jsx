import React from 'react'

const Message = ({ message }) => {
  const isUser = message.role === 'user'

  const formatTime = (ts) => {
    if (!ts) return ''
    const date = new Date(ts)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in mb-2`}>
      <div
        className={`
          max-w-[80%] md:max-w-[70%] p-4 md:p-5 shadow-premium
          ${isUser
            ? 'bg-gradient-to-br from-indigo-600 to-accent text-white rounded-[2rem] rounded-tr-md'
            : 'glass text-text rounded-[2rem] rounded-tl-md hover:scale-[1.01] transition-transform duration-300'
          } 
          break-words relative
        `}
      >
        {message.isImage ? (
          <div className="rounded-2xl overflow-hidden border border-border/10 shadow-lg bg-black/5">
            <img src={message.content} alt="generated" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
          </div>
        ) : (
          <div className="text-[15px] leading-relaxed font-semibold tracking-tight whitespace-pre-wrap">
            {message.content}
          </div>
        )}

        <div className={`
          text-[10px] mt-3 font-black uppercase tracking-[0.1em]
          ${isUser ? 'text-white/60 text-right' : 'text-muted opacity-70'}
        `}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}

export default Message
