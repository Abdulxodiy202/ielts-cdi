'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, ChevronRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchActivePlan, type StudyPlan } from '@/lib/utils/studyPlan'

// Bento tile: current week's study plan progress at a glance. Fetches
// its own data (active plan + login streak). Empty state offers a
// "Reja tuzish" button that calls generate_weekly_plan directly.

interface CategoryRow {
  label: string
  done: number
  total: number
  color: string
  retry?: boolean
}

function planRows(plan: StudyPlan): CategoryRow[] {
  const readingTotal = (plan.reading_test_ids?.length ?? 0) + (plan.reading_retry_ids?.length ?? 0)
  const listeningTotal = (plan.listening_test_ids?.length ?? 0) + (plan.listening_retry_ids?.length ?? 0)
  const rows: CategoryRow[] = [
    { label: 'Reading',   done: plan.reading_completed,   total: readingTotal,        color: '#6366f1', retry: (plan.reading_retry_ids?.length ?? 0) > 0 },
    { label: 'Listening', done: plan.listening_completed, total: listeningTotal,      color: '#10b981', retry: (plan.listening_retry_ids?.length ?? 0) > 0 },
    { label: 'Script',    done: plan.script_completed,    total: plan.script_target,  color: '#f59e0b' },
    { label: 'Vocab',     done: plan.vocab_completed,     total: plan.vocab_target,   color: '#a855f7' },
    { label: 'Article',   done: plan.article_completed,   total: plan.article_target, color: '#0ea5e9' },
    { label: 'Video',     done: plan.video_completed,     total: plan.video_target,   color: '#ec4899' },
  ]
  if (plan.typing_minutes_target > 0) {
    rows.push({ label: 'Typing', done: plan.typing_minutes_completed, total: plan.typing_minutes_target, color: '#94a3b8' })
  }
  // 0-target rows carry no signal; drop them rather than show 0/0 bars.
  return rows.filter(r => r.total > 0)
}

export function StudyPlanWidget() {
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [p, streakRes] = await Promise.all([
      fetchActivePlan(supabase, user.id),
      supabase.from('user_login_streak').select('current_streak').eq('user_id', user.id).maybeSingle(),
    ])
    setPlan(p)
    setStreak((streakRes.data as { current_streak?: number } | null)?.current_streak ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.rpc('generate_weekly_plan', { p_user_id: user.id })
      await load()
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-5 w-40 rounded animate-pulse mb-4" style={{ background: 'var(--bg-secondary)' }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 rounded animate-pulse mb-3" style={{ background: 'var(--bg-secondary)' }} />
        ))}
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-6">
        <div className="text-4xl mb-3">📋</div>
        <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Study Plan hali yo&apos;q</p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Haftalik reja tuzib, progressingizni kuzating
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {generating ? 'Tuzilmoqda…' : 'Reja tuzish'}
        </button>
      </div>
    )
  }

  const rows = planRows(plan)
  const totalTarget = rows.reduce((s, r) => s + r.total, 0)
  const totalDone = rows.reduce((s, r) => s + Math.min(r.done, r.total), 0)
  const percent = totalTarget > 0 ? Math.min(100, Math.round((totalDone / totalTarget) * 100)) : 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList size={20} style={{ color: 'var(--accent)' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Bu haftalik reja</h2>
        {plan.is_completed && (
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            ✓ Bajarildi
          </span>
        )}
      </div>

      {/* Overall */}
      <div className="mb-4">
        <div className="h-2 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--bg-secondary)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, background: percent >= 100 ? '#10b981' : 'var(--accent)' }}
          />
        </div>
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{percent}% bajarildi</p>
      </div>

      {/* Category rows */}
      <div className="flex-1 space-y-2.5">
        {rows.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Bu hafta uchun vazifalar hali belgilanmagan.
          </p>
        ) : rows.map(r => {
          const complete = r.done >= r.total
          const pct = Math.min(100, (r.done / r.total) * 100)
          return (
            <div key={r.label} className="flex items-center gap-2 text-sm">
              <span
                className="w-[72px] shrink-0 inline-flex items-center gap-1 text-xs font-medium"
                style={{ color: complete ? '#10b981' : 'var(--text-secondary)' }}
              >
                {complete && <Check size={11} />}
                {r.retry && !complete && <span title="Qayta ishlash tavsiya etilgan">🔄</span>}
                {r.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: complete ? '#10b981' : r.color }}
                />
              </div>
              <span className="w-10 text-right text-xs shrink-0" style={{ color: complete ? '#10b981' : 'var(--text-muted)' }}>
                {Math.min(r.done, r.total)}/{r.total}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
          🔥 Streak: {streak} kun
        </span>
        <Link
          href="/dashboard/study-plan"
          className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity"
          style={{ color: 'var(--accent)' }}
        >
          Batafsil ko&apos;rish <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}
