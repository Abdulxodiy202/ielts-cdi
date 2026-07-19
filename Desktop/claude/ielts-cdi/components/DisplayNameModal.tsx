'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ display_name: value, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (upErr) { setError(upErr.message); return }
      setShow(false)
      onComplete?.()
    } finally {
      setSaving(false)
    }
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { setError("Ism bo'sh bo'lishi mumkin emas"); return }
    if (/[@<>]/.test(trimmed)) { setError("Ismda @, < yoki > belgilar bo'lmasin"); return }
    if (trimmed.length > MAX_LEN) { setError(`Ism ${MAX_LEN} belgidan oshmasin`); return }
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
          Leaderboard&apos;da qanday ko&apos;rinasiz?
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          Ismingizni kiriting — bu leaderboard&apos;da boshqa foydalanuvchilarga ko&apos;rinadi
        </p>

        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Ismingiz
        </label>
        <input
          autoFocus
          value={name}
          maxLength={MAX_LEN}
          onChange={e => { setName(e.target.value); setError(null) }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="Masalan: Abdulxodiy"
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
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  )
}
