'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Settings as SettingsIcon, Check, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'

// Dashboard settings. Currently hosts the daily-plan toggle + (for
// premium users) the weekly/daily mode selector. Free users never see
// the mode selector -- they're locked to 'daily_free' by tier.

type Mode = 'weekly' | 'daily'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [mode, setMode] = useState<Mode>('weekly')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const [profileRes, settingsRes] = await Promise.all([
      supabase.from('profiles').select('daily_plan_enabled, is_premium, premium_until').eq('id', user.id).single(),
      supabase.from('user_plan_settings').select('mode').eq('user_id', user.id).maybeSingle(),
    ])
    setEnabled(Boolean((profileRes.data as { daily_plan_enabled?: boolean } | null)?.daily_plan_enabled))
    setIsPremium(isActivePremium(profileRes.data))
    const m = (settingsRes.data as { mode?: string } | null)?.mode
    setMode(m === 'daily' ? 'daily' : 'weekly')
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  async function toggle() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const next = !enabled
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ daily_plan_enabled: next })
        .eq('id', user.id)
      if (upErr) { setError(upErr.message); return }
      setEnabled(next)

      // On turn-on: kick the router RPC so today's plan lands right
      // away instead of waiting for the midnight cron.
      if (next) {
        const { error: genErr } = await supabase.rpc('generate_plan_for_user', { p_user_id: user.id })
        if (genErr) console.error('[settings] generate_plan_for_user failed:', genErr.message)
        setToast("Bugungi rejangiz tayyor")
        setTimeout(() => setToast(null), 4000)
      }
    } finally {
      setBusy(false)
    }
  }

  // Premium-only: switch between weekly and AI-daily plan modes. Also
  // triggers a fresh plan generation so the /dashboard/study-plan view
  // reflects the new mode immediately.
  async function changeMode(next: Mode) {
    if (busy || !isPremium || mode === next) return
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: upErr } = await supabase
        .from('user_plan_settings')
        .upsert({ user_id: user.id, mode: next }, { onConflict: 'user_id' })
      if (upErr) { setError(upErr.message); return }
      setMode(next)
      const { error: genErr } = await supabase.rpc('generate_plan_for_user', { p_user_id: user.id })
      if (genErr) console.error('[settings] generate_plan_for_user failed:', genErr.message)
      setToast('Rejim yangilandi')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-4">
        <div className="h-6 w-40 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
        <ChevronLeft size={14} /> Bosh sahifaga qaytish
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <SettingsIcon size={26} style={{ color: 'var(--accent)' }} /> Sozlamalar
        </h1>
      </div>

      {toast && (
        <div
          className="mb-4 p-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <Check size={16} /> {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      <div
        className="p-5 md:p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
              Kunlik AI plan
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Har kuni sizga moslashtirilgan reja tayyorlanadi
            </p>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="rounded-full relative transition-colors disabled:opacity-50 shrink-0"
            style={{
              width: 46,
              height: 26,
              background: enabled ? 'var(--accent)' : 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
            aria-pressed={enabled}
            aria-label="Kunlik AI plan"
          >
            <span
              className="absolute top-0.5 rounded-full bg-white transition-all"
              style={{ width: 20, height: 20, left: enabled ? 23 : 2 }}
            />
          </button>
        </div>

        {enabled && (
          <p
            className="mt-4 pt-4 text-xs leading-relaxed"
            style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
          >
            Har kuni yarim tunda yangi reja tayyor bo&apos;ladi. Bepul foydalanuvchilar 7 kunlik
            reja oladi, Premium foydalanuvchilar uchun har kuni AI tomonidan yangilanadigan
            individual reja.
          </p>
        )}

        {/* Free-tier info: no mode selector, just an explanation of what
            the upgrade unlocks. Premium gets the actual selector below. */}
        {!isPremium && (
          <p
            className="mt-4 pt-4 text-xs leading-relaxed inline-flex items-start gap-2"
            style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}
          >
            <Lock size={12} className="mt-0.5 shrink-0" style={{ color: '#F59E0B' }} />
            <span>
              Bepul foydalanuvchilar 7 kunlik bepul reja oladi. Individual haftalik yoki AI kunlik
              reja Premium&apos;da mavjud.
            </span>
          </p>
        )}
      </div>

      {/* Premium-only mode selector. Hidden entirely for free users --
          they have no mode choice, they're on daily_free by tier. */}
      {isPremium && (
        <div
          className="mt-4 p-5 md:p-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16 }}
        >
          <h2 className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
            Reja rejimi
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Haftalik reja bir hafta uchun, AI kunlik reja har kuni yangilanadi
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'weekly' as const, title: 'Haftalik', desc: 'Bir hafta uchun bir reja' },
              { key: 'daily' as const,  title: 'AI kunlik', desc: 'Har kuni yangilanadi' },
            ]).map(o => {
              const active = mode === o.key
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => changeMode(o.key)}
                  disabled={busy}
                  className="p-4 rounded-xl text-left disabled:opacity-50 transition-colors"
                  style={active
                    ? { background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.55)' }
                    : { background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="font-bold text-sm mb-1" style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {o.title}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
