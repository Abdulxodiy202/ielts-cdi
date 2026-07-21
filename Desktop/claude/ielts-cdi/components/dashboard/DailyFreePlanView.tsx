'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, Headphones, Mic, FileText, Video, Type, Check, ChevronRight, Lock, Crown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { StudyPlan } from '@/lib/utils/studyPlan'

// Free-daily study-plan view: renders today's tasks per the spec.
// Read-only from the user's perspective -- progress is bumped by the
// six activity endpoints via bumpPlanProgress. Uzbek copy throughout,
// sentence case, formal tone.

interface Props { plan: StudyPlan }

const UZ_WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr']

function fmtTodayUz(dateStr: string): string {
  const d = new Date(dateStr)
  const wd = UZ_WEEKDAYS[d.getDay()]
  const wdCap = wd.charAt(0).toUpperCase() + wd.slice(1)
  return `Bugun, ${d.getDate()}-${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${wdCap}`
}

interface TestInfo { id: string; title: string }

function TaskCard({
  color, icon: Icon, title, subtitle, done, href,
}: {
  color: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  title: string
  subtitle?: string
  done: boolean
  href: string
}) {
  return (
    <div
      className="p-5 flex flex-col transition-transform hover:-translate-y-0.5"
      style={{
        background: 'var(--bg-card)',
        border: done ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      {done ? (
        <span
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
        >
          <Check size={14} /> Bajarildi
        </span>
      ) : (
        <Link
          href={href}
          className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: color }}
        >
          Boshlash <ChevronRight size={13} />
        </Link>
      )}
    </div>
  )
}

export function DailyFreePlanView({ plan }: Props) {
  const [titles, setTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    const ids = [...(plan.reading_test_ids ?? []), ...(plan.listening_test_ids ?? [])]
    if (ids.length === 0) return
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('tests').select('id, title').in('id', ids)
      const map: Record<string, string> = {}
      for (const t of ((data as TestInfo[] | null) ?? [])) map[t.id] = t.title
      setTitles(map)
    }
    load()
  }, [plan.reading_test_ids, plan.listening_test_ids])

  const readingIds = plan.reading_test_ids ?? []
  const listeningIds = plan.listening_test_ids ?? []

  const totalDone =
    Math.min(plan.reading_completed, readingIds.length)
    + Math.min(plan.listening_completed, listeningIds.length)
    + Math.min(plan.script_completed, plan.script_target)
    + Math.min(plan.article_completed, plan.article_target)
    + Math.min(plan.video_completed, plan.video_target)
    + Math.min(plan.vocab_completed, plan.vocab_target)
  const totalTarget =
    readingIds.length + listeningIds.length
    + plan.script_target + plan.article_target + plan.video_target + plan.vocab_target
  const percent = totalTarget > 0 ? Math.min(100, Math.round((totalDone / totalTarget) * 100)) : 0
  const complete = percent >= 100

  return (
    <div className="space-y-5">
      {/* Header + progress */}
      <div
        className="p-5 md:p-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
        }}
      >
        <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
          {fmtTodayUz(plan.period_start)}
        </p>
        <div className="flex flex-wrap items-baseline gap-3 mb-3">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {totalDone}/{totalTarget} vazifa bajarildi
          </h1>
          {complete && <span className="text-2xl">🎉</span>}
        </div>
        <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-secondary)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, background: complete ? '#22c55e' : '#6366f1' }}
          />
        </div>
        {complete && (
          <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>
            🎉 Bugungi rejangizni to&apos;liq bajardingiz!
          </p>
        )}
      </div>

      {/* Bento grid of tasks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {readingIds.map((id, i) => (
          <TaskCard
            key={`r-${id}`}
            color="#3B82F6"
            icon={BookOpen}
            title="Reading Test"
            subtitle={titles[id]}
            done={plan.reading_completed >= i + 1}
            href={`/reading/${id}`}
          />
        ))}
        {listeningIds.map((id, i) => (
          <TaskCard
            key={`l-${id}`}
            color="#A855F7"
            icon={Headphones}
            title="Listening Test"
            subtitle={titles[id]}
            done={plan.listening_completed >= i + 1}
            href={`/listening/${id}`}
          />
        ))}
        {plan.script_target > 0 && (
          <TaskCard
            color="#EAB308"
            icon={Mic}
            title={`Script Practice — ${plan.script_target} mashq`}
            subtitle={`${Math.min(plan.script_completed, plan.script_target)}/${plan.script_target}`}
            done={plan.script_completed >= plan.script_target}
            href="/listening/script"
          />
        )}
        {plan.article_target > 0 && (
          <TaskCard
            color="#F97316"
            icon={FileText}
            title={`Article — ${plan.article_target} maqola`}
            subtitle={`${Math.min(plan.article_completed, plan.article_target)}/${plan.article_target}`}
            done={plan.article_completed >= plan.article_target}
            href="/articles"
          />
        )}
        {plan.video_target > 0 && (
          <TaskCard
            color="#EF4444"
            icon={Video}
            title={`Video Darsi — ${plan.video_target} dars`}
            subtitle={`${Math.min(plan.video_completed, plan.video_target)}/${plan.video_target}`}
            done={plan.video_completed >= plan.video_target}
            href="/video-lessons"
          />
        )}
        {plan.vocab_target > 0 && (
          <TaskCard
            color="#22C55E"
            icon={Type}
            title={`Vocabulary — ${plan.vocab_target} level`}
            subtitle={`${Math.min(plan.vocab_completed, plan.vocab_target)}/${plan.vocab_target}`}
            done={plan.vocab_completed >= plan.vocab_target}
            href="/vocabulary"
          />
        )}
      </div>
    </div>
  )
}

export function DailyFreeLockedView() {
  return (
    <div className="max-w-2xl mx-auto">
      <div
        className="p-6 md:p-10 text-center"
        style={{
          background: 'linear-gradient(160deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04) 60%, var(--bg-card))',
          border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 20,
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)' }}
        >
          <Lock size={30} style={{ color: '#F59E0B' }} />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Bepul haftalik reja yakunlandi
        </h1>
        <div className="text-sm md:text-base leading-relaxed space-y-3 mb-6" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Siz platformadagi barcha bepul materiallarni bir hafta davomida muvaffaqiyatli
            o&apos;zlashtirdingiz. Bu jiddiy natija va siz o&apos;z ustingizda izchil ishlashga
            tayyorligingizni ko&apos;rsatdingiz.
          </p>
          <p>Endi keyingi bosqichga o&apos;tish vaqti keldi. Premium obuna sizga quyidagilarni beradi:</p>
        </div>
        <ul className="text-sm md:text-base text-left space-y-2 mb-8 max-w-xl mx-auto" style={{ color: 'var(--text-primary)' }}>
          {[
            'Har kuni sizning natijalaringiz asosida yangilanadigan individual reja',
            "30+ qo'shimcha Reading va Listening testlari (bir oyga yetadi)",
            'Barcha 100 ta Vocabulary levellari',
            "Barcha Script Practice va Article materiallari",
            'Writing va Speaking uchun AI baholash',
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <Check size={18} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/premium"
            className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Crown size={16} /> Premium olish
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Materiallarni takrorlash
          </Link>
        </div>
      </div>
    </div>
  )
}
