import React, { useState } from 'react'
import { useAppContext } from '../context'
import toast from 'react-hot-toast'
import { assets } from '../assets/assets'

const Login = () => {
  const [state, setState] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { axios, setToken } = useAppContext()

  // Forgot Password States
  const [isForgot, setIsForgot] = useState(false)
  const [resetStep, setResetStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const url = state === 'login' ? '/api/user/login' : '/api/user/register'

    try {
      const { data } = await axios.post(url, { name, email, password })
      if (data.success) {
        setToken(data.token)
        localStorage.setItem('token', data.token)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      toast.error(msg)
      
      // If account not found, switch to register mode automatically
      if (err.response?.status === 404 && !isForgot) {
        setTimeout(() => setState('register'), 1000)
      }

      // If account already exists, switch to login mode automatically
      if (err.response?.status === 409 && state === 'register') {
        setTimeout(() => setState('login'), 1000)
      }
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    try {
      if (resetStep === 1) {
        const { data } = await axios.post('/api/user/forgot-password', { email })
        if (data.success) {
          toast.success(data.message)
          setResetStep(2)
        } else toast.error(data.message)
      } else if (resetStep === 2) {
        const { data } = await axios.post('/api/user/verify-otp', { email, otp: otp.trim() })
        if (data.success) {
          toast.success(data.message)
          setResetStep(3)
        } else toast.error(data.message)
      } else if (resetStep === 3) {
        const { data } = await axios.post('/api/user/reset-password', { email, otp: otp.trim(), newPassword })
        if (data.success) {
          toast.success(data.message)
          setIsForgot(false)
          setResetStep(1)
          setOtp('')
          setNewPassword('')
          setPassword('')
          setState('login')
        } else toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
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
        onSubmit={isForgot ? handleForgotPassword : handleSubmit}
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
            <img src={assets.logo} className="w-14 rounded-xl" alt="logo" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-center">
            {isForgot ? (
              <>Reset <span className="text-gradient">Access</span></>
            ) : state === 'login' ? (
              <>Welcome <span className="text-gradient">Back</span></>
            ) : (
              <>Join the <span className="text-gradient">Future</span></>
            )}
          </h1>
          <p className="text-muted text-[10px] font-black mt-3 opacity-80 uppercase tracking-widest text-center px-4">
            {isForgot ? `Step ${resetStep} of 3` : state === 'login' ? 'Continue your creative journey' : 'Start your neural odyssey today'}
          </p>
        </div>

        {/* Input Fields Container */}
        <div className="space-y-5">
          {!isForgot && state === 'register' && (
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} type="text" required placeholder="Enter your name"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Email Address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="name@example.com" disabled={isForgot && resetStep > 1}
              className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all disabled:opacity-50" />
          </div>

          {isForgot && resetStep >= 2 && (
            <div className="space-y-2 animate-slide-up">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Recovery Code</label>
              <input value={otp} onChange={e => setOtp(e.target.value.replace(/\s/g, ''))} type="text" inputMode="numeric" required placeholder="Enter 6-digit code" disabled={resetStep > 2}
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all disabled:opacity-50" />
            </div>
          )}

          {isForgot && resetStep === 3 && (
            <div className="space-y-2 animate-slide-up">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">New Password</label>
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" required placeholder="Min 6 characters"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}

          {!isForgot && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted">Secret Password</label>
                {state === 'login' && (
                  <span onClick={() => { setIsForgot(true); setResetStep(1); setOtp(''); setNewPassword(''); setPassword(''); }} className="text-[10px] font-bold text-accent cursor-pointer hover:underline">Forgot?</span>
                )}
              </div>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}
        </div>

        {/* Switch mode context */}
        {!isForgot ? (
          <p className="text-[10px] text-muted mt-8 mb-6 text-center font-bold uppercase tracking-wider">
            {state === 'register' ? 'Already part of the community? ' : 'New to the platform? '}
            <span onClick={() => setState(state === 'login' ? 'register' : 'login')}
              className="text-accent font-black cursor-pointer hover:underline underline-offset-4 decoration-2">
              {state === 'register' ? 'Sign in' : 'Create account'}
            </span>
          </p>
        ) : (
          <p className="text-[10px] text-muted mt-8 mb-6 text-center font-bold uppercase tracking-wider">
            Remembered your password? 
            <span onClick={() => { setIsForgot(false); setResetStep(1); setOtp(''); setNewPassword(''); }}
              className="text-accent font-black cursor-pointer hover:underline underline-offset-4 decoration-2"> Back to Login</span>
          </p>
        )}

        {/* Action Button */}
        <button
          type="submit"
          className="w-full py-4 text-sm font-black uppercase tracking-widest rounded-2xl bg-accent text-white shadow-lg hover:shadow-accent/40 hover:scale-[1.02] active:scale-95 transition-all duration-300"
        >
          {isForgot 
            ? (resetStep === 1 ? 'Send Code' : resetStep === 2 ? 'Verify Code' : 'Update Password')
            : (state === 'register' ? 'Establish Account' : 'Authenticate')}
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
