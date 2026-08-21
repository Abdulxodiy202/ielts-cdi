'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// One-time onboarding for the leaderboard: if the profile has no real
// display_name (null or still the email prefix default), block with a
// modal asking for one. Deliberately NOT dismissible via backdrop or
// Escape -- the leaderboard needs SOMETHING to show, so the only exits
// are Save (their name) or Skip (random "UserNNNN" handle).

const MAX_LEN = 20

interface DisplayNameModalProps {
  /** Controlled mode: parent decides visibility (used by the dashboard
      modal orchestrator so onboarding can queue behind this). When
      omitted, the component self-checks the profile as before. */
  open?: boolean
  /** Fired after a successful save/skip so the orchestrator can advance
      to the next queued modal. */
  onComplete?: () => void
}

export function DisplayNameModal({ open, onComplete }: DisplayNameModalProps = {}) {
  const { t } = useLanguage()
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open !== undefined) { setShow(open); return }
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
      const emailPrefix = user.email?.split('@')[0]
      const dn = (profile as { display_name?: string | null } | null)?.display_name
      if (!dn || dn === emailPrefix) setShow(true)
    }
    check()
  }, [open])

  async function persist(value: string) {
    setSaving(true)
    setError(null)
    try {
      // Route through the /api/profile PATCH endpoint instead of a raw
      // client SDK update. Two wins:
      //   1. The endpoint chains `.select().maybeSingle()` and returns a
      //      500 when zero rows write (RLS block or missing profile row)
      //      -- previously a silent no-op showed a bogus "Saved" toast.
      //   2. We also bump `full_name` so the dashboard greeting fallback
      //      (`display_name || full_name?.split(' ')[0]`) stays in sync
      //      even if some future read path drops display_name.
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: value, full_name: value }),
      })
      type ProfilePatchResponse = {
        ok?: boolean
        error?: string
        message?: string
        profile?: { display_name?: string | null; full_name?: string | null }
        recheck?: { display_name?: string | null } | null
      }
      const json = await res.json().catch(() => ({})) as ProfilePatchResponse
      console.log('[DisplayNameModal] PATCH response:', res.status, json)
      if (!res.ok) {
        setError(json.message ?? json.error ?? t('profile.saveFailed') ?? 'Save failed')
        return
      }
      // Verify the DB actually landed the new value. If the API's
      // RECHECK snapshot disagrees with what we sent, a trigger is
      // clobbering the write and no amount of router.refresh() will
      // help -- surface the mismatch instead of the misleading toast.
      const saved = json.profile?.display_name ?? null
      if (saved !== value) {
        console.error('[DisplayNameModal] DB kept stale value', { sent: value, saved, recheck: json.recheck })
        setError(`DB kept stale value (saved="${saved ?? 'null'}"). Check Vercel logs.`)
        return
      }
      setShow(false)
      onComplete?.()
      // Dashboard greeting + sidebar name come from a Server Component
      // that reads profiles.display_name at request time -- refresh so
      // the just-persisted value replaces the stale server payload
      // instead of waiting for a full navigation.
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { setError(t('profile.nameEmpty')); return }
    if (/[@<>]/.test(trimmed)) { setError(t('profile.nameInvalidChars')); return }
    if (trimmed.length > MAX_LEN) { setError(t('profile.nameTooLong', { max: MAX_LEN })); return }
    persist(trimmed)
  }

  function handleSkip() {
    persist('User' + Math.floor(1000 + Math.random() * 9000))
  }

  if (!show) return null

  return (
    // No onClick-to-close on the backdrop and no Escape handler --
    // intentionally blocking until a choice is made.
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('profile.leaderboardTitle')}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          {t('profile.leaderboardHint')}
        </p>

        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {t('profile.yourName')}
        </label>
        <input
          autoFocus
          value={name}
          maxLength={MAX_LEN}
          onChange={e => { setName(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder={t('profile.namePlaceholderExample')}
          className="w-full px-3 py-2.5 rounded-xl text-sm mb-2 outline-none"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        {error && <p className="text-xs mb-2" style={{ color: 'var(--error)' }}>{error}</p>}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {t('profile.skip')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {saving ? t('profile.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
