'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AtSign, Check, Loader2, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Shared username-change dialog used by the sidebar profile section and
// the leaderboard's own-row edit icon. Validates + probes uniqueness the
// same way signup does, then PATCHes /api/profile/username. Parent gets
// the new value via `onSaved` so it can update its cached profile without
// a refetch.
//
// Design note: the sync status (idle/invalid) is derived from `value`
// each render rather than mirrored via setState in an effect -- keeps
// react-hooks/set-state-in-effect happy and avoids cascading updates.
// Only the async network verdict (checking/available/taken) lives in
// useState because it can't be computed synchronously.

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

type NetStatus = 'idle' | 'checking' | 'available' | 'taken'
type Status = NetStatus | 'invalid'

interface Props {
  open: boolean
  currentUsername: string | null
  onClose: () => void
  onSaved: (newUsername: string) => void
}

export function UsernameEditModal({ open, currentUsername, onClose, onSaved }: Props) {
  const { t } = useLanguage()
  // Remount Inner on every open<->close transition so `value` and
  // `error` reset to their initial values without a setState-in-effect.
  return (
    <Inner
      key={open ? 'open' : 'closed'}
      open={open}
      currentUsername={currentUsername}
      onClose={onClose}
      onSaved={onSaved}
      t={t}
    />
  )
}

// Actual dialog body. Remounted whenever the modal opens so all local
// state (value, network status, error) starts fresh -- no reset effect
// needed.
function Inner({
  open, currentUsername, onClose, onSaved, t,
}: Props & { t: (k: string) => string }) {
  const [value, setValue] = useState(currentUsername ?? '')
  const [netStatus, setNetStatus] = useState<NetStatus>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derived sync validity -- keeps setState out of the effect body.
  const isRegexInvalid = value.length > 0 && !USERNAME_RE.test(value)
  const isUnchanged = value === (currentUsername ?? '')
  const status: Status = useMemo(() => {
    if (!value) return 'idle'
    if (isRegexInvalid) return 'invalid'
    if (isUnchanged) return 'idle'
    return netStatus
  }, [value, isRegexInvalid, isUnchanged, netStatus])

  // Debounced availability probe. Only runs when the value is a fresh,
  // regex-valid candidate. State updates happen inside the async
  // callback (fine per set-state-in-effect rule) or via the cleanup.
  useEffect(() => {
    if (!open) return
    if (!value || isRegexInvalid || isUnchanged) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setNetStatus('checking')
      try {
        const res = await fetch(`/api/profile/username?value=${encodeURIComponent(value)}`, { signal: controller.signal })
        const json = await res.json() as { available: boolean; valid?: boolean }
        if (controller.signal.aborted) return
        setNetStatus(json.available ? 'available' : 'taken')
      } catch {
        // Ignore; save-time check will catch real conflicts.
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [value, open, isRegexInvalid, isUnchanged])

  async function save() {
    if (!USERNAME_RE.test(value)) { setError(t('auth.usernameHint')); return }
    if (status === 'taken') { setError(t('auth.usernameTaken')); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/username', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      })
      const json = await res.json().catch(() => ({})) as { username?: string; error?: string }
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      onSaved(json.username ?? value)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('profile.changeUsername')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {t('auth.usernameHint')}
            </p>

            <div className="relative mb-2">
              <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                onKeyDown={e => { if (e.key === 'Enter') save() }}
                minLength={3}
                maxLength={20}
                placeholder="username"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {status === 'checking' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
                {status === 'available' && <Check size={14} style={{ color: '#22c55e' }} />}
                {(status === 'taken' || status === 'invalid') && <X size={14} style={{ color: '#ef4444' }} />}
              </span>
            </div>

            <p
              className="text-xs mb-4 min-h-[16px]"
              style={{
                color: status === 'taken' ? '#ef4444'
                  : status === 'invalid' ? '#ef4444'
                  : status === 'available' ? '#22c55e'
                  : 'var(--text-muted)',
              }}
            >
              {status === 'taken' ? t('auth.usernameTaken')
                : status === 'invalid' ? t('auth.usernameHint')
                : status === 'available' ? t('auth.usernameAvailable')
                : ''}
            </p>

            {error && (
              <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || status === 'taken' || status === 'invalid' || status === 'checking' || value === currentUsername || !value}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : t('common.save')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
