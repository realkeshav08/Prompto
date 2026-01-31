import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'

const Loading = () => {
  const navigate = useNavigate()
  const { fetchUser } = useAppContext()

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchUser()
      navigate('/')
    }, 8000)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="
      h-screen w-screen
      flex flex-col items-center justify-center
      bg-[#0d1117]
      text-gray-300
    ">
      {/* Spinner */}
      <div className="
        w-10 h-10 mb-4
        border-2 border-[#30363d]
        border-t-[#7aa2f7]
        rounded-full
        animate-spin
      " />

      {/* Optional status text */}
      <p className="text-sm text-gray-500 tracking-wide">
        Initializing workspace…
      </p>
    </div>
  )
}

export default Loading
