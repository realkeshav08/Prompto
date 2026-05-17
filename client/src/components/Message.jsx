import React from 'react'
import ReactMarkdown from 'react-markdown'

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
          max-w-[80%] md:max-w-[70%] p-5 md:p-6 shadow-premium
          ${isUser
            ? 'bg-gradient-to-br from-indigo-600 to-accent text-white rounded-[2rem] rounded-tr-md'
            : 'glass text-text rounded-[2rem] rounded-tl-md hover:scale-[1.01] transition-transform duration-300'
          }
          ${message.failed ? 'ring-2 ring-red-500/60' : ''}
          break-words relative
        `}
      >
        {message.isVideo ? (
          <div className="rounded-2xl overflow-hidden border border-border/10 shadow-lg bg-black/5 min-h-[200px] flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-accent/5 animate-pulse group-data-[loaded=true]:hidden" />
            <video 
              src={message.content} 
              autoPlay 
              loop 
              muted 
              playsInline
              onLoadedData={(e) => e.target.parentElement.setAttribute('data-loaded', 'true')}
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500 relative z-10" 
            />
          </div>
        ) : message.isImage ? (
          <div className="rounded-2xl overflow-hidden border border-border/10 shadow-lg bg-black/5 min-h-[200px] flex items-center justify-center relative group">
            <div className="absolute inset-0 bg-accent/5 animate-pulse group-data-[loaded=true]:hidden" />
            <img 
              src={message.content} 
              alt="generated" 
              onLoad={(e) => e.target.parentElement.setAttribute('data-loaded', 'true')}
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500 relative z-10" 
            />
          </div>
        ) : isUser ? (
          <div className="text-[15px] leading-relaxed font-semibold tracking-tight whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <div className="chat-md text-[15px]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
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
