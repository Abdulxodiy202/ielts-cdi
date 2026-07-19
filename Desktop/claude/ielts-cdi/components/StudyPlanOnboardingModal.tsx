'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// First-time Study Plan setup. Multi-step, not dismissible via backdrop
// -- exits only by finishing (which writes user_plan_settings + generates
// the first weekly plan). Free users never see the mode step; they get
// 'weekly' silently. Uzbek copy is intentional -- matches the platform's
// default language and the spec's exact wording.

type Step = 'intro' | 'typing' | 'mode' | 'confirm' | 'done'

interface StudyPlanOnboardingModalProps {
  open: boolean
  isPremium: boolean
  onComplete: () => void
}

export function StudyPlanOnboardingModal({ open, isPremium, onComplete }: StudyPlanOnboardingModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('intro')
  const [includeTyping, setIncludeTyping] = useState(true)
  const [mode, setMode] = useState<'weekly' | 'daily'>('weekly')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const steps: Step[] = isPremium
    ? ['intro', 'typing', 'mode', 'confirm']
    : ['intro', 'typing', 'confirm']
  const stepIndex = steps.indexOf(step === 'done' ? 'confirm' : step)

  function goNext() {
    const i = steps.indexOf(step)
    if (i >= 0 && i < steps.length - 1) setStep(steps[i + 1])
  }
  function goBack() {
    const i = steps.indexOf(step)
    if (i > 0) setStep(steps[i - 1])
  }

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error: upErr } = await supabase.from('user_plan_settings').upsert({
        user_id: user.id,
        mode: isPremium ? mode : 'weekly',
        include_typing: includeTyping,
        onboarded: true,
        // Premium users lock their mode choice for a week; free users
        // have nothing to lock (mode is fixed to weekly anyway).
        mode_locked_until: isPremium ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      }, { onConflict: 'user_id' })
      if (upErr) { setError(upErr.message); return }

      const { error: genErr } = await supabase.rpc('generate_weekly_plan', { p_user_id: user.id })
      if (genErr) { setError(genErr.message); return }

      setStep('done')
      // Brief success beat, then hand control back + refresh server data.
      setTimeout(() => {
        onComplete()
        router.refresh()
      }, 1400)
    } finally {
      setSaving(false)
    }
  }

  const cardBase: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'border-color .15s, background .15s',
  }
  const cardActive: React.CSSProperties = {
    ...cardBase,
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.55)',
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Progress dots */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 mb-5">
            {steps.map((s, i) => (
              <span
                key={s}
                className="rounded-full transition-all"
                style={{
                  width: i === stepIndex ? 24 : 8,
                  height: 8,
                  background: i <= stepIndex ? 'var(--accent)' : 'var(--bg-secondary)',
                  border: i <= stepIndex ? 'none' : '1px solid var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {step === 'intro' && (
          <>
            <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              📋 Study Plan bilan tanishing
            </h2>
            <div className="text-sm leading-relaxed mb-6 space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <p>Har hafta sizga maxsus reja tuziladi:</p>
              <ul className="space-y-1 pl-1">
                <li>• Reading va Listening testlar</li>
                <li>• Vocabulary, Script, Article, Video mashqlari</li>
                <li>• Progress kuzatib boriladi</li>
                <li>• Bajarsangiz — bonus ballar olasiz 🎁</li>
              </ul>
              <p>Kelinglar, tez sozlash qilaylik.</p>
            </div>
            <button
              onClick={goNext}
              className="w-full py-3 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              Boshlash <ChevronRight size={16} />
            </button>
          </>
        )}

        {step === 'typing' && (
          <>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              ⌨️ Typing mashqini rejaga qo&apos;shamizmi?
            </h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
              Typing tezligingizni oshirish IELTS&apos;da yozish uchun foydali. Rejaga qo&apos;shsangiz,
              har hafta typing daqiqalari qo&apos;shiladi. Xohlaganingizda sozlamalardan
              o&apos;chirishingiz mumkin.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setIncludeTyping(true)}
                className="p-4 text-center"
                style={includeTyping ? cardActive : cardBase}
              >
                <Check size={20} className="mx-auto mb-1" style={{ color: '#10b981' }} />
                <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Ha, qo&apos;sh</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>(tavsiya)</div>
              </button>
              <button
                onClick={() => setIncludeTyping(false)}
                className="p-4 text-center"
                style={!includeTyping ? cardActive : cardBase}
              >
                <X size={20} className="mx-auto mb-1" style={{ color: 'var(--text-muted)' }} />
                <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Yo&apos;q</div>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={goBack} className="flex-1 py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <ChevronLeft size={15} /> Orqaga
              </button>
              <button onClick={goNext} className="flex-1 py-3 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Keyingi <ChevronRight size={15} />
              </button>
            </div>
          </>
        )}

        {step === 'mode' && (
          <>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              🎯 Rejim tanlang
            </h2>
            <div
              className="text-xs font-semibold px-3 py-2 rounded-lg mb-4"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              ⚠️ Tanlaganingizdan keyin 1 hafta o&apos;zgartira olmaysiz!
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={() => setMode('weekly')} className="p-4 text-left" style={mode === 'weekly' ? cardActive : cardBase}>
                <div className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>📅 Haftalik</div>
                <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
                  Bir hafta uchun bir plan. Moslashuvchan.
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  Tavsiya etiladi
                </span>
              </button>
              <button onClick={() => setMode('daily')} className="p-4 text-left" style={mode === 'daily' ? cardActive : cardBase}>
                <div className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>📆 Kunlik</div>
                <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
                  Har kuni yangi vazifa (zaif nuqtaga fokus)
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                  Advanced
                </span>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={goBack} className="flex-1 py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <ChevronLeft size={15} /> Orqaga
              </button>
              <button onClick={goNext} className="flex-1 py-3 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Keyingi <ChevronRight size={15} />
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              🚀 Tayyor!
            </h2>
            <div
              className="text-sm rounded-xl p-4 mb-5 space-y-1"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Sizning tanlovlaringiz:</p>
              <p>• Typing: <strong>{includeTyping ? 'Ha' : "Yo'q"}</strong></p>
              {isPremium && <p>• Rejim: <strong>{mode === 'weekly' ? 'Haftalik' : 'Kunlik'}</strong></p>}
              <p className="pt-2" style={{ color: 'var(--text-muted)' }}>Birinchi haftalik reja hoziroq tuziladi.</p>
            </div>
            {error && <p className="text-xs mb-3" style={{ color: 'var(--error)' }}>{error}</p>}
            <div className="flex gap-3">
              <button onClick={goBack} disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <ChevronLeft size={15} /> Orqaga
              </button>
              <button onClick={finish} disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {saving ? 'Tuzilmoqda…' : 'Rejani tuzish'} {!saving && <ChevronRight size={15} />}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Reja tuzildi!</p>
          </div>
        )}
      </div>
    </div>
  )
}
