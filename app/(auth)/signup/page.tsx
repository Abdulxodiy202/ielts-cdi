'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, User, AtSign, Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Username availability probe. Debounced in the effect below -- we only
// hit the endpoint after the user pauses typing for 400ms. Regex mirrors
// the server so we short-circuit obvious garbage without a round-trip.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Debounced availability check. We don't cancel in-flight requests --
  // the last one wins because setUsernameStatus only runs after the fetch
  // resolves and we compare against the current input.
  useEffect(() => {
    if (!username) { setUsernameStatus('idle'); return }
    if (!USERNAME_RE.test(username)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile/username?value=${encodeURIComponent(username)}`, { signal: controller.signal })
        const json = await res.json() as { available: boolean; valid?: boolean }
        // Guard against a later keystroke racing an earlier response.
        setUsername(current => {
          if (current !== username) return current
          if (!json.valid) setUsernameStatus('invalid')
          else setUsernameStatus(json.available ? 'available' : 'taken')
          return current
        })
      } catch {
        // Network error: leave status as checking; the signup call itself
        // will surface any real conflict.
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [username])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      setError(t('auth.usernameTaken'))
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          display_name: name,
          username,
        },
      },
    })
    if (error) { setError(error.message); setLoading(false); return }
    // Auto-assign referral code immediately after signup
    await fetch('/api/referral/generate', { method: 'POST' }).catch(() => null)
    router.push('/dashboard')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="40" height="44" viewBox="0 0 36 40" fill="none">
                <path d="M18 0L0 7V20C0 30 8 38 18 40C28 38 36 30 36 20V7L18 0Z" fill="#1e40af"/>
                <path d="M18 4L4 10V20C4 28 10 35 18 37C26 35 32 28 32 20V10L18 4Z" fill="#2563eb"/>
                <path d="M13 20L16.5 23.5L23 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '22px', letterSpacing: '1px' }}>IELTS</span>
                  <span style={{ color: '#60a5fa', fontWeight: '700', fontSize: '15px' }}>.PRO</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '8px', letterSpacing: '2px', fontWeight: '600' }}>BAND 9 STARTS HERE.</div>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('auth.createAccount')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('auth.createSubtitle')}
          </p>
        </div>

        <div className="card p-8">
          {error && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.fullName')}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  className="input-field pl-10"
                  type="text"
                  placeholder="John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.username')}
              </label>
              <div className="relative">
                <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  className="input-field pl-10 pr-9"
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                  minLength={3}
                  maxLength={20}
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
                  {usernameStatus === 'available' && <Check size={14} style={{ color: '#22c55e' }} />}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <X size={14} style={{ color: '#ef4444' }} />}
                </span>
              </div>
              <p
                className="text-xs mt-1"
                style={{
                  color:
                    usernameStatus === 'taken' ? '#ef4444' :
                    usernameStatus === 'invalid' ? '#ef4444' :
                    usernameStatus === 'available' ? '#22c55e' :
                    'var(--text-muted)',
                }}
              >
                {usernameStatus === 'taken' ? t('auth.usernameTaken')
                  : usernameStatus === 'available' ? t('auth.usernameAvailable')
                  : t('auth.usernameHint')}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  className="input-field pl-10"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  className="input-field pl-10 pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder={t('auth.minChars')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking'}
              className="btn-primary w-full mt-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : t('auth.createAccountBtn')}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            {t('auth.haveAccount')}{' '}
            <Link href="/login" style={{ color: 'var(--accent)' }} className="font-medium hover:underline">
              {t('auth.signInLink')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
