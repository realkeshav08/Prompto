import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context'
import toast from 'react-hot-toast'

const LEGAL_UPDATED = 'May 17, 2026'

const CREDIT_COSTS = [
  ['Text chat', 1],
  ['Study AI', 2],
  ['Image generation', 2],
  ['Video generation', 4],
]

const TERMS = [
  ['Acceptance of Terms', 'By creating an account or using Prompto, you agree to these Terms of Service. If you do not agree, please do not use the service.'],
  ['The Service', 'Prompto provides AI-powered tools for text generation, image creation, and document-grounded Study AI. Access to these features is governed by a credit system.'],
  ['Acceptable Use', 'You agree not to use Prompto to generate or distribute unlawful, harmful, hateful, deceptive, or abusive content, to infringe intellectual property, or to disrupt or reverse-engineer the service. You are responsible for the prompts you submit and the content you generate.'],
  ['Credits & Payments', 'Features consume credits per use. Credits may be purchased through our payment processor, Stripe. Credits are automatically refunded when a generation fails, but are otherwise non-refundable. Prices and credit costs may change over time.'],
  ['AI-Generated Content', 'AI output may be inaccurate, incomplete, or unintended. It is provided for assistance only and should be independently verified before being relied upon.'],
  ['Availability', 'The service is provided "as is" and "as available", without warranties of any kind. We may modify, suspend, or discontinue features at any time.'],
  ['Account Termination', 'You may stop using Prompto at any time. We may suspend or terminate accounts that violate these terms.'],
]

const PRIVACY = [
  ['Information We Collect', 'We collect your name and email address (used for sign-in and account recovery), your chat history, and any documents or URLs you upload for the Study AI feature.'],
  ['How We Use It', 'Your information is used solely to provide and operate Prompto — authenticating you, storing your chats, powering document-grounded answers, and processing credit purchases.'],
  ['Security', 'Passwords are stored only as salted bcrypt hashes — never in plain text. Authentication uses signed JWT tokens.'],
  ['Third-Party Services', 'AI requests are processed by Google Gemini. Generated images are hosted on ImageKit. Payments are handled by Stripe — we never see or store your card details. Data is stored in MongoDB Atlas.'],
  ['Your Control', 'You can delete individual chats and uploaded documents at any time from within the app. Deleting a document also removes its indexed content.'],
  ['Data Sharing', 'We do not sell your personal data. Information is shared only with the processors above, strictly to operate the service.'],
  ['Contact', 'For privacy questions, contact the account owner via the email associated with this deployment.'],
]

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'plan', label: 'Plan' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'terms', label: 'Terms of Service' },
  { id: 'privacy', label: 'Privacy Policy' },
]

const fieldClass =
  'w-full bg-accent-soft/40 border border-border/60 rounded-xl px-4 py-2.5 text-sm font-medium text-text outline-none focus:border-accent/50 transition-all disabled:opacity-50'

const LegalView = ({ title, sections }) => (
  <div className="space-y-5">
    <div>
      <h3 className="text-base font-black text-text">{title}</h3>
      <p className="text-[11px] text-muted mt-1">Last updated: {LEGAL_UPDATED}</p>
    </div>
    {sections.map(([heading, body]) => (
      <div key={heading}>
        <h4 className="text-sm font-bold text-text mb-1">{heading}</h4>
        <p className="text-[13px] text-muted leading-relaxed">{body}</p>
      </div>
    ))}
  </div>
)

const Settings = ({ isOpen, onClose }) => {
  const { user, setUser, theme, setTheme, axios, navigate, setToken } = useAppContext()

  const [tab, setTab] = useState('profile')
  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  // Reset the form to current values each time the panel opens.
  useEffect(() => {
    if (isOpen) {
      setTab('profile')
      setName(user?.name || '')
      setCurPw(''); setNewPw(''); setConfirmPw('')
    }
  }, [isOpen, user?.name])

  if (!isOpen) return null

  const saveName = async () => {
    const trimmed = name.trim()
    if (trimmed.length < 2) return toast.error('Name must be at least 2 characters')
    if (trimmed === user?.name) return toast('That is already your name')
    setSavingName(true)
    try {
      const { data } = await axios.post('/api/user/update-profile', { name: trimmed })
      if (data.success) {
        setUser(data.user)
        toast.success('Profile updated')
      } else toast.error(data.message)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSavingName(false)
    }
  }

  const submitPassword = async () => {
    if (!curPw || !newPw) return toast.error('Fill in all password fields')
    if (newPw.length < 6) return toast.error('New password must be at least 6 characters')
    if (newPw !== confirmPw) return toast.error('New passwords do not match')
    setChangingPw(true)
    try {
      const { data } = await axios.post('/api/user/change-password', {
        currentPassword: curPw,
        newPassword: newPw,
      })
      if (data.success) {
        toast.success('Password changed')
        setCurPw(''); setNewPw(''); setConfirmPw('')
      } else toast.error(data.message)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setChangingPw(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    onClose()
    toast.success('Logged out')
  }

  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass rounded-3xl w-full max-w-2xl shadow-premium flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/40">
          <h2 className="text-lg font-black text-text">⚙️ Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-accent/10 text-muted hover:text-text transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 px-5 pt-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                tab === t.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-accent-soft/40 text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">

          {tab === 'profile' && (
            <div className="space-y-6">
              {/* Identity */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-xl font-black text-white uppercase">
                  {(user?.name || '?').charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text truncate">{user?.name}</p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                  <p className="text-[10px] text-muted/70 mt-0.5">Member since {joined}</p>
                </div>
              </div>

              {/* Display name */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted">Display Name</label>
                <div className="flex gap-2">
                  <input value={name} onChange={e => setName(e.target.value)} maxLength={60} className={fieldClass} />
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    className="px-4 rounded-xl bg-accent text-white text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-all"
                  >
                    {savingName ? '…' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted">Email</label>
                <input value={user?.email || ''} disabled className={fieldClass} />
                <p className="text-[10px] text-muted/70">Email is your account identity and cannot be changed.</p>
              </div>

              {/* Change password */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted pt-2">Change Password</label>
                <input type="password" placeholder="Current password" value={curPw} onChange={e => setCurPw(e.target.value)} className={fieldClass} />
                <input type="password" placeholder="New password (min 6 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} className={fieldClass} />
                <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={fieldClass} />
                <button
                  onClick={submitPassword}
                  disabled={changingPw}
                  className="w-full py-2.5 rounded-xl bg-accent/10 text-accent text-sm font-bold disabled:opacity-40 hover:bg-accent/20 transition-all"
                >
                  {changingPw ? 'Updating…' : 'Update Password'}
                </button>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500/20 transition-all"
              >
                Log Out
              </button>
            </div>
          )}

          {tab === 'plan' && (
            <div className="space-y-6">
              <div className="glass rounded-2xl p-5 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Credit Balance</p>
                <p className="text-4xl font-black text-accent mt-1">{user?.credits ?? 0}</p>
                <p className="text-xs text-muted mt-1">credits available</p>
              </div>

              <p className="text-[13px] text-muted leading-relaxed">
                Prompto runs on a pay-as-you-go <strong className="text-text">credit system</strong> — there is no
                recurring subscription. You only spend credits when you use a feature.
              </p>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Credit Costs</p>
                {CREDIT_COSTS.map(([label, cost]) => (
                  <div key={label} className="flex justify-between items-center px-4 py-2.5 bg-accent-soft/40 rounded-xl">
                    <span className="text-sm font-semibold text-text">{label}</span>
                    <span className="text-sm font-black text-accent">{cost} {cost === 1 ? 'credit' : 'credits'}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { onClose(); navigate('/credits') }}
                className="w-full py-3 rounded-xl bg-accent text-white text-sm font-black uppercase tracking-widest hover:opacity-90 transition-all"
              >
                Buy Credits
              </button>
            </div>
          )}

          {tab === 'personalization' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Theme</p>
                <div className="grid grid-cols-2 gap-3">
                  {['light', 'dark'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTheme(mode)}
                      className={`py-4 rounded-2xl text-sm font-bold capitalize border transition-all ${
                        theme === mode
                          ? 'bg-accent text-white border-accent shadow-sm'
                          : 'bg-accent-soft/40 text-muted border-border/60 hover:text-text'
                      }`}
                    >
                      {mode === 'light' ? '☀️ Light' : '🌙 Dark'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted/70">Your theme preference is saved on this device.</p>
              </div>
            </div>
          )}

          {tab === 'terms' && <LegalView title="Terms of Service" sections={TERMS} />}
          {tab === 'privacy' && <LegalView title="Privacy Policy" sections={PRIVACY} />}

        </div>
      </div>
    </div>
  )
}

export default Settings
