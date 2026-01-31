import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'

const Login = () => {
  const [state, setState] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { axios, setToken } = useAppContext()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const url =
      state === 'login'
        ? '/api/user/login'
        : '/api/user/register'

    try {
      const { data } = await axios.post(url, {
        name,
        email,
        password
      })

      if (data.success) {
        setToken(data.token)
        localStorage.setItem('token', data.token)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="
      min-h-screen w-full
      flex items-center justify-center
      bg-[#0d1117]
      text-gray-200
    ">
      <form
        onSubmit={handleSubmit}
        className="
          w-[360px]
          bg-[#161b22]
          border border-[#30363d]
          rounded-md
          p-8
        "
      >
        {/* Title */}
        <h1 className="text-xl font-semibold text-center mb-6">
          {state === 'login' ? 'Sign in' : 'Create account'}
        </h1>

        {/* Name */}
        {state === 'register' && (
          <div className="mb-4">
            <label className="block text-xs mb-1 text-gray-400">
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              type="text"
              required
              className="
                w-full px-3 py-2
                bg-[#0d1117]
                border border-[#30363d]
                rounded-md
                text-sm
                outline-none
                focus:border-[#7aa2f7]
              "
            />
          </div>
        )}

        {/* Email */}
        <div className="mb-4">
          <label className="block text-xs mb-1 text-gray-400">
            Email
          </label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            required
            className="
              w-full px-3 py-2
              bg-[#0d1117]
              border border-[#30363d]
              rounded-md
              text-sm
              outline-none
              focus:border-[#7aa2f7]
            "
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-xs mb-1 text-gray-400">
            Password
          </label>
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            type="password"
            required
            className="
              w-full px-3 py-2
              bg-[#0d1117]
              border border-[#30363d]
              rounded-md
              text-sm
              outline-none
              focus:border-[#7aa2f7]
            "
          />
        </div>

        {/* Switch mode */}
        <p className="text-xs text-gray-500 mb-5 text-center">
          {state === 'register'
            ? 'Already have an account? '
            : 'New here? '}
          <span
            onClick={() =>
              setState(state === 'login' ? 'register' : 'login')
            }
            className="text-[#7aa2f7] cursor-pointer"
          >
            {state === 'register' ? 'Sign in' : 'Create account'}
          </span>
        </p>

        {/* Action */}
        <button
          type="submit"
          className="
            w-full py-2
            text-sm font-medium
            rounded-md
            bg-[#7aa2f7]
            text-black
            hover:opacity-90
            transition
          "
        >
          {state === 'register'
            ? 'Create account'
            : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default Login
