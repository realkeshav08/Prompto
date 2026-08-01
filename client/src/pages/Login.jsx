import React, { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context'
import toast from 'react-hot-toast'
import { assets } from '../assets/assets'
import { isStrongPassword, PASSWORD_REQUIREMENTS } from '../utils/password'
import PasswordChecklist from '../components/PasswordChecklist'
import PasswordInput from '../components/PasswordInput'
import OtpInput from '../components/OtpInput'

/* Prompt + action shown beneath the form ("New to the platform? Create account").
   The action is its own block rather than inline text: as one run, a two-word
   label wraps mid-phrase on narrow screens and reads as "CREATE" / "ACCOUNT" on
   separate lines. Giving it a line of its own — and forbidding a break inside it
   — keeps the label intact at every width. */
const SwitchPrompt = ({ label, action, onAction }) => (
  <p className="text-[10px] text-muted mt-8 mb-6 text-center font-bold uppercase tracking-wider">
    {label}
    <button
      type="button"
      onClick={onAction}
      className="block w-full mt-1.5 whitespace-nowrap text-accent font-black uppercase tracking-wider cursor-pointer hover:underline underline-offset-4 decoration-2"
    >
      {action}
    </button>
  </p>
)

const Login = () => {
  const [state, setState] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const { axios, setAuthed } = useAppContext()

  // Forgot Password States
  const [isForgot, setIsForgot] = useState(false)
  const [resetStep, setResetStep] = useState(1) // 1: Email, 2: OTP, 3: New Password
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // Email verification (post-signup / unverified login)
  const [verifyMode, setVerifyMode] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')

  // In-flight request. Drives the button's pending label and blocks a second
  // submit — without it, a slow network looks like a dead button and invites
  // repeat clicks (each one spending a rate-limit slot, or re-sending a code).
  const [submitting, setSubmitting] = useState(false)

  const formRef = useRef(null)

  /* A 6-digit code has exactly one sensible next action, so submit it as soon
     as the last digit lands instead of asking for a click. requestSubmit() goes
     through the form's normal onSubmit, so the manual button and this path stay
     one code path. The last auto-sent code is remembered so a rejected code
     doesn't resubmit itself in a loop — re-entering a digit arms it again. */
  const autoSentCode = useRef('')
  const pendingCode = verifyMode ? verifyCode : isForgot && resetStep === 2 ? otp : ''

  useEffect(() => {
    // Cleared field ⇒ a new step, or the user is retyping: arm it again.
    if (pendingCode.length === 0) autoSentCode.current = ''
    if (pendingCode.length !== 6 || submitting) return
    if (autoSentCode.current === pendingCode) return
    autoSentCode.current = pendingCode
    formRef.current?.requestSubmit()
  }, [pendingCode, submitting])

  const enterVerify = (msg) => {
    setVerifyMode(true)
    setVerifyCode('')
    if (msg) toast(msg)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const url = state === 'login' ? '/api/user/login' : '/api/user/register'

    // Strong-password + match gate on registration only (login just checks creds).
    if (state === 'register') {
      if (!isStrongPassword(password)) {
        toast.error(PASSWORD_REQUIREMENTS)
        return
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match')
        return
      }
    }

    if (submitting) return
    setSubmitting(true)
    try {
      const { data } = await axios.post(url, { name, email, password })

      // Registration (or login of an unverified account) returns a
      // needsVerification flag instead of a token — switch to the code step.
      if (data.needsVerification) {
        enterVerify(data.message || 'Check your email for a verification code')
        return
      }

      if (data.success) {
        // The server set the httpOnly auth cookie on this response; we only
        // flip the local session flag to trigger bootstrap.
        setAuthed(true)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      // Login blocked because the email isn't verified yet (HTTP 403).
      if (err.response?.data?.needsVerification) {
        enterVerify(err.response.data.message || 'Please verify your email to continue')
        return
      }

      const msg = err.response?.data?.message || err.message
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const { data } = await axios.post('/api/user/verify-email', { email, code: verifyCode.trim() })
      if (data.success) {
        toast.success('Email verified — welcome to Prompto!')
        setAuthed(true)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendVerification = async () => {
    try {
      const { data } = await axios.post('/api/user/resend-verification', { email })
      toast.success(data.message || 'A new code has been sent')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    }
  }

  const exitVerify = () => {
    setVerifyMode(false)
    setVerifyCode('')
    setState('login')
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
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
        if (!isStrongPassword(newPassword)) {
          toast.error(PASSWORD_REQUIREMENTS)
          return
        }
        if (newPassword !== confirmPassword) {
          toast.error('Passwords do not match')
          return
        }
        const { data } = await axios.post('/api/user/reset-password', { email, otp: otp.trim(), newPassword })
        if (data.success) {
          // Password reset now logs the user straight in (server set the cookie).
          toast.success(data.message)
          setAuthed(true)
        } else toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden bg-bg text-text">
      {/* Fixed ambient background — stays put and never adds scroll height */}
      <div className="fixed top-[-10%] right-[-10%] w-[600px] h-[600px] bg-accent/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Centers the card when it fits; the outer div scrolls when it's taller */}
      <div className="min-h-dvh w-full flex items-center justify-center relative z-10 px-4 sm:px-6 py-8 sm:py-10">
      <form
        ref={formRef}
        onSubmit={isForgot ? handleForgotPassword : verifyMode ? handleVerify : handleSubmit}
        className="
          w-full max-w-[420px]
          glass rounded-[2rem] sm:rounded-[2.5rem]
          p-6 sm:p-10 md:p-12 shadow-premium
          animate-fade-in relative z-10
        "
      >
        {/* Brand/Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 flex items-center justify-center mb-6 hover:rotate-12 transition-transform duration-500">
            <img src={assets.logo} className="w-14 rounded-xl" alt="logo" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-center">
            {verifyMode ? (
              <>Verify <span className="text-gradient">Email</span></>
            ) : isForgot ? (
              <>Reset <span className="text-gradient">Access</span></>
            ) : state === 'login' ? (
              <>Welcome <span className="text-gradient">Back</span></>
            ) : (
              <>Study <span className="text-gradient">Smarter</span></>
            )}
          </h1>
          <p className="text-muted text-[10px] font-black mt-3 opacity-80 uppercase tracking-widest text-center px-4">
            {verifyMode
              ? 'Enter the code sent to your email'
              : isForgot ? `Step ${resetStep} of 3` : state === 'login' ? 'Pick up where you left off' : 'Your AI study partner awaits'}
          </p>
        </div>

        {/* Input Fields Container */}
        <div className="space-y-5">
          {!isForgot && !verifyMode && state === 'register' && (
            <div className="space-y-2">
              <label htmlFor="name" className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Full Name</label>
              <input id="name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} type="text" required placeholder="Enter your name"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}

          {/* Email — only on the initial step (login/register, or reset step 1) */}
          {(!isForgot || resetStep === 1) && !verifyMode && (
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Email Address</label>
              <input id="email" name="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="name@example.com"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}

          {verifyMode && (
            <div className="space-y-2 animate-slide-up">
              <span className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Verification Code</span>
              <OtpInput value={verifyCode} onChange={setVerifyCode} autoFocus />
              <p className="text-[10px] text-muted ml-1">
                Didn't get it?{' '}
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="whitespace-nowrap text-accent font-bold cursor-pointer hover:underline"
                >
                  Resend code
                </button>
              </p>
            </div>
          )}

          {isForgot && resetStep === 2 && (
            <div className="space-y-2 animate-slide-up">
              <span className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Recovery Code</span>
              <OtpInput value={otp} onChange={setOtp} autoFocus />
            </div>
          )}

          {isForgot && resetStep === 3 && (
            <div className="space-y-2 animate-slide-up">
              <label htmlFor="newPassword" className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">New Password</label>
              <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Enter new password"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
              {newPassword && <PasswordChecklist value={newPassword} />}
              <label htmlFor="confirmNewPassword" className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Confirm Password</label>
              <PasswordInput id="confirmNewPassword" name="confirmNewPassword" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}

          {!isForgot && !verifyMode && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label htmlFor="password" className="block text-[10px] font-black uppercase tracking-widest text-muted">Secret Password</label>
                {state === 'login' && (
                  <span onClick={() => { setIsForgot(true); setResetStep(1); setOtp(''); setNewPassword(''); setPassword(''); setConfirmPassword(''); }} className="text-[10px] font-bold text-accent cursor-pointer hover:underline">Forgot?</span>
                )}
              </div>
              <PasswordInput id="password" name="password" autoComplete={state === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter your password"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}

          {!isForgot && !verifyMode && state === 'register' && (
            <div className="space-y-2">
              {password && <PasswordChecklist value={password} />}
              <label htmlFor="confirmPassword" className="block text-[10px] font-black uppercase tracking-widest text-muted ml-1">Confirm Password</label>
              <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Re-enter password"
                className="w-full px-5 py-3.5 bg-accent-soft/30 border border-border/50 rounded-2xl text-sm font-medium outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all" />
            </div>
          )}
        </div>

        {/* Switch mode context */}
        {verifyMode ? (
          <SwitchPrompt label="Wrong email?" action="Back to Login" onAction={exitVerify} />
        ) : !isForgot ? (
          <SwitchPrompt
            label={state === 'register' ? 'Already part of the community?' : 'New to the platform?'}
            action={state === 'register' ? 'Sign in' : 'Create account'}
            onAction={() => { setState(state === 'login' ? 'register' : 'login'); setConfirmPassword('') }}
          />
        ) : (
          <SwitchPrompt
            label="Remembered your password?"
            action="Back to Login"
            onAction={() => { setIsForgot(false); setResetStep(1); setOtp(''); setNewPassword(''); setConfirmPassword('') }}
          />
        )}

        {/* Action Button — the pending label names the step in progress, so a
            slow request reads as "still working" rather than "nothing happened". */}
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="w-full py-4 text-sm font-black uppercase tracking-widest rounded-2xl bg-accent text-white shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:shadow-accent/40 enabled:hover:scale-[1.02] enabled:active:scale-95"
        >
          {submitting
            ? (verifyMode
              ? 'Verifying…'
              : isForgot
                ? (resetStep === 1 ? 'Sending…' : resetStep === 2 ? 'Verifying…' : 'Updating…')
                : (state === 'register' ? 'Creating account…' : 'Signing in…'))
            : (verifyMode
              ? 'Verify Email'
              : isForgot
                ? (resetStep === 1 ? 'Send Code' : resetStep === 2 ? 'Verify Code' : 'Update Password')
                : (state === 'register' ? 'Establish Account' : 'Authenticate'))}
        </button>
      </form>
      </div>
    </div>
  )
}

export default Login
