'use client'

import Link from 'next/link'
import {
  BookOpen, Headphones, Crown, Star, TrendingUp, ArrowRight,
  Gamepad2, Keyboard, Mic, Video, Sparkles, Lock,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getBandColor } from '@/lib/utils/bandScore'
import { LeaderboardWidget } from '@/components/dashboard/LeaderboardWidget'
import { StudyPlanWidget } from '@/components/dashboard/StudyPlanWidget'
import { ReferralCard } from '@/components/dashboard/ReferralCard'
import { RecentTestsCompact } from '@/components/dashboard/RecentTestsCompact'

// Bento-grid dashboard body. Pure presentation -- every number arrives
// as a prop from the server page so this stays one render pass. The
// leaderboard widget is the only tile that fetches its own data (it
// needs focus-refresh behaviour).

interface Stats {
  totalTests: number
  averageBand: number
  highestBand: number
  testsThisWeek: number
}

interface Counts {
  readingTotal: number
  readingFree: number
  listeningTotal: number
  listeningFree: number
}

export interface RankInfo {
  rank: number
  total_points: number
  total_users: number
}

interface BentoDashboardProps {
  firstName: string
  isPremium: boolean
  stats: Stats
  counts: Counts
  readingDone: number
  listeningDone: number
  rank: RankInfo | null
  gameCompleted: number
  videoCount: number
  resume: { href: string; title: string } | null
  results: unknown[]
}

const tileStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 16,
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
  return (
    <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: 'var(--bg-secondary)' }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
    </div>
  )
}

export function BentoDashboard({
  firstName, isPremium, stats, counts, readingDone, listeningDone,
  rank, gameCompleted, videoCount, resume, results,
}: BentoDashboardProps) {
  const { t } = useLanguage()

  const secondaryTiles = [
    { href: '/vocabulary',       icon: Gamepad2, color: '#22c55e', title: t('nav.vocabulary'),   sub: `${gameCompleted}/100` },
    { href: '/typing',           icon: Keyboard, color: '#a855f7', title: t('nav.typing'),       sub: t('dashboard.typingModes') },
    { href: '/listening/script', icon: Mic,      color: '#06b6d4', title: t('script.title'),     sub: 'BBC style' },
    { href: '/video-lessons',    icon: Video,    color: '#ec4899', title: t('nav.videoCourses'), sub: t('dashboard.videosCount', { count: videoCount }) },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">

      {/* ── Hero ── */}
      <div
        className="lg:col-span-6 p-5 md:p-6 flex flex-col transition-colors"
        style={{
          ...tileStyle,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08) 50%, var(--bg-card))',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('dashboard.hello')} {firstName} 👋
          </h1>
          {!isPremium && (
            <Link
              href="/premium"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
              style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--premium)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <Crown size={14} /> {t('dashboard.upgradeToPremium')}
            </Link>
          )}
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {stats.totalTests === 0
            ? t('dashboard.readyToStart')
            : t('dashboard.completedTests', { count: stats.totalTests })}
        </p>
        {resume && (
          <Link
            href={resume.href}
            className="mt-auto pt-4 inline-flex items-center gap-2 text-sm font-semibold self-start px-4 py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', marginTop: 'auto' }}
          >
            {t('dashboard.resumeTest')}: {resume.title} <ArrowRight size={15} />
          </Link>
        )}
      </div>

      {/* ── Total points + rank ── */}
      <div className="lg:col-span-3 p-5 md:p-6 transition-colors" style={tileStyle}>
        <div className="flex items-center gap-2 mb-2">
          <Star size={22} fill="#fbbf24" strokeWidth={0} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {t('dashboard.totalPoints')}
          </span>
        </div>
        <div className="text-3xl md:text-4xl font-bold" style={{ color: '#fbbf24' }}>
          {rank?.total_points ?? 0}
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {rank
            ? t('dashboard.rankOf', { rank: rank.rank, total: rank.total_users })
            : t('dashboard.notRanked')}
        </p>
      </div>

      {/* ── Avg band ── */}
      <div className="lg:col-span-3 p-5 md:p-6 transition-colors" style={tileStyle}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={22} style={{ color: getBandColor(stats.averageBand) }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {t('stats.averageBand')}
          </span>
        </div>
        <div className="text-3xl md:text-4xl font-bold" style={{ color: getBandColor(stats.averageBand) }}>
          {stats.averageBand.toFixed(1)}
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('stats.highestBand')}: {stats.highestBand.toFixed(1)} · {stats.testsThisWeek} {t('dashboard.thisWeekSuffix')}
        </p>
      </div>

      {/* ── Reading ── */}
      <Link href="/reading" className="lg:col-span-6 p-5 md:p-6 group transition-colors hover:border-[var(--accent)]" style={tileStyle}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <BookOpen size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.readingTests')}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('dashboard.testsFree', { total: counts.readingTotal, free: counts.readingFree })}
            </div>
          </div>
          <ArrowRight size={18} className="ml-auto group-hover:translate-x-1 transition-transform shrink-0" style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t('dashboard.completedOf', { done: readingDone, total: counts.readingTotal })}
        </p>
        <ProgressBar done={readingDone} total={counts.readingTotal} />
      </Link>

      {/* ── Listening ── */}
      <Link href="/listening" className="lg:col-span-6 p-5 md:p-6 group transition-colors hover:border-[var(--accent)]" style={tileStyle}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(236,72,153,0.15)' }}>
            <Headphones size={22} style={{ color: '#ec4899' }} />
          </div>
          <div className="min-w-0">
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.listeningTests')}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('dashboard.testsFree', { total: counts.listeningTotal, free: counts.listeningFree })}
            </div>
          </div>
          <ArrowRight size={18} className="ml-auto group-hover:translate-x-1 transition-transform shrink-0" style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {t('dashboard.completedOf', { done: listeningDone, total: counts.listeningTotal })}
        </p>
        <ProgressBar done={listeningDone} total={counts.listeningTotal} />
      </Link>

      {/* ── Study plan (premium) yoki promo (free) + leaderboard ── */}
      <div
        className="lg:col-span-6 p-5 md:p-6 transition-colors"
        style={{
          ...tileStyle,
          background: isPremium
            ? tileStyle.background
            : 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(236,72,153,0.06) 60%, var(--bg-card))',
          borderColor: isPremium ? undefined : 'rgba(168,85,247,0.30)',
        }}
      >
        {isPremium ? (
          <StudyPlanWidget />
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.30)' }}
              >
                <Sparkles size={22} style={{ color: '#c084fc' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Shaxsiy Study Plan
                  </h2>
                  <Lock size={13} style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Premium&apos;da har kuni sizga moslashtirilgan reja
                </p>
              </div>
            </div>

            <ul className="flex-1 space-y-2 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {['Har kuni yangilanadigan AI reja', 'Zaif tomonlarga qaratilgan mashqlar', 'Streak va bonuslar tizimi'].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <span style={{ color: '#22c55e' }}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/premium"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
            >
              <Crown size={15} /> Premium&apos;ga o&apos;tish
            </Link>
          </div>
        )}
      </div>
      <div className="lg:col-span-6 p-5 md:p-6 transition-colors" style={tileStyle}>
        <LeaderboardWidget />
      </div>

      {/* ── Secondary skill tiles ── */}
      {secondaryTiles.map(tile => {
        const Icon = tile.icon
        return (
          <Link
            key={tile.href}
            href={tile.href}
            className="lg:col-span-3 p-5 group transition-colors hover:border-[var(--accent)]"
            style={tileStyle}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${tile.color}20` }}>
              <Icon size={20} style={{ color: tile.color }} />
            </div>
            <div className="font-bold text-sm mb-0.5 truncate" style={{ color: 'var(--text-primary)' }}>{tile.title}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{tile.sub}</div>
          </Link>
        )
      })}

      {/* ── Recent tests (compact expandable list) + referral card
          side by side on desktop; stacked tests-first on mobile ── */}
      <div className="lg:col-span-7 p-5 md:p-6 transition-colors" style={tileStyle}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <RecentTestsCompact results={results as any} />
      </div>
      <div className="lg:col-span-5">
        <ReferralCard />
      </div>
    </div>
  )
}
