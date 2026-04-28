import React, { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
import { assets } from '../assets/assets'

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
      bg-bg relative overflow-hidden
      text-text px-6
    ">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-accent/10 blur-[130px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent/5 blur-[100px] rounded-full" />

      <form
        onSubmit={handleSubmit}
        className="
          w-full max-w-[420px]
          glass rounded-[2.5rem]
          p-10 md:p-12 shadow-premium
          animate-fade-in relative z-10
        "
      >
        {/* Brand/Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 flex items-center justify-center mb-6 hover:rotate-12 transition-transform duration-500">
            <img src={assets.logo} className="w-10" alt="logo" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-center">
            {state === 'login' ? (
              <>Welcome <span className="text-gradient">Back</span></>
            ) : (
              <>Join the <span className="text-gradient">Future</span></>
            )}
          </h1>
          <p className="text-muted text-sm font-bold mt-3 opacity-80 uppercase tracking-widest text-center px-4">
            {state === 'login' ? 'Continue your creative journey' : 'Start your neural odyssey today'}
          </p>
        </div>

        {/* Input Fields Container */}
        <div className="space-y-5">
          {state === 'register' && (
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-widest text-muted ml-1">
                Full Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                type="text"
                required
                placeholder="Enter your name"
                className="
                  w-full px-5 py-4
                  bg-accent-soft/30
                  border border-border/50
                  rounded-2xl
                  text-sm font-medium
                  outline-none
                  focus:border-accent/40 focus:ring-4 focus:ring-accent/5
                  transition-all
                "
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-widest text-muted ml-1">
              Email Address
            </label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              required
              placeholder="name@example.com"
              className="
                w-full px-5 py-4
                bg-accent-soft/30
                border border-border/50
                rounded-2xl
                text-sm font-medium
                outline-none
                focus:border-accent/40 focus:ring-4 focus:ring-accent/5
                transition-all
              "
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-widest text-muted ml-1">
              Secret Password
            </label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              required
              placeholder="••••••••"
              className="
                w-full px-5 py-4
                bg-accent-soft/30
                border border-border/50
                rounded-2xl
                text-sm font-medium
                outline-none
                focus:border-accent/40 focus:ring-4 focus:ring-accent/5
                transition-all
              "
            />
          </div>
        </div>

        {/* Switch mode context */}
        <p className="text-xs text-muted mt-8 mb-6 text-center font-medium">
          {state === 'register'
            ? 'Already part of the community? '
            : 'New to the platform? '}
          <span
            onClick={() =>
              setState(state === 'login' ? 'register' : 'login')
            }
            className="text-accent font-bold cursor-pointer hover:underline underline-offset-4 decoration-2"
          >
            {state === 'register' ? 'Sign in' : 'Create account'}
          </span>
        </p>

        {/* Action Button */}
        <button
          type="submit"
          className="
            w-full py-4
            text-sm font-black uppercase tracking-widest
            rounded-2xl
            bg-accent
            text-white shadow-lg
            hover:shadow-accent/40 hover:scale-[1.02]
            active:scale-95
            transition-all duration-300
          "
        >
          {state === 'register'
            ? 'Establish Account'
            : 'Authenticate'}
        </button>
      </form>

      {/* Footer Branding */}
      <p className="absolute bottom-8 text-[10px] font-black text-muted uppercase tracking-[0.3em] opacity-70">
        Prompto Intelligence Systems • v2.0
      </p>
    </div>
  )
}

export default Login
