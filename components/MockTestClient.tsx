'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Calendar, Clock, CheckCircle, CreditCard, BookOpen,
  Headphones, PenTool, ArrowRight, Loader2,
  RefreshCw, PartyPopper, XCircle, Ban, Users, AlertTriangle,
} from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useAllBookingCounts } from '@/lib/hooks/useAllBookingCounts'
import { useMyBookings } from '@/lib/hooks/useMyBookings'
import { createClient } from '@/lib/supabase/client'

/** How long the user must wait after admin rejects a booking before
 *  submitting a new one for the same schedule. Matches the server-side
 *  guard in /api/payment. */
const REJECT_COOLDOWN_MS = 5 * 60 * 1000

export interface MockScheduleWithBooking {
  id: string
  date: string
  time: string
  status: 'scheduled' | 'active' | 'completed'
  reading_file_url: string | null
  listening_file_url: string | null
  writing_task1_image_url: string | null
  writing_task1_topic: string | null
  writing_task2_topic: string | null
  /** NULL = unlimited seats; integer ≥ 1 = hard cap (migration 030). */
  capacity: number | null
  userBooking:      { id: string; status: string; payment_status: string } | null
  isSubmitted:      boolean
  submissionStatus: string | null
}

interface Props {
  userId: string
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function formatDisplayDate(dateStr: string) {
  return new Date(dateStr + 'T00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', weekday: 'long',
  })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const hour   = parseInt(h)
  const ampm   = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${String(display).padStart(2, '0')}:${m} ${ampm}`
}

/**
 * Parse schedule date+time stored as Asia/Tashkent (UTC+5) → UTC ms.
 * Without +05:00, new Date("2024-10-15T09:00") is local/UTC, not Tashkent.
 */
function tashkentMs(date: string, time: string): number {
  const hhmm = time.slice(0, 5) // normalise "09:00:00" → "09:00"
  return new Date(`${date}T${hhmm}:00+05:00`).getTime()
}

/** ms remaining until test START time (Tashkent). Negative = test already started. */
function msUntilTest(s: MockScheduleWithBooking): number {
  return tashkentMs(s.date, s.time) - Date.now()
}

/** True from test start → 4 hours after (Tashkent). */
function isTestLive(s: MockScheduleWithBooking): boolean {
  const start = tashkentMs(s.date, s.time)
  const end   = start + 4 * 60 * 60 * 1000
  const now   = Date.now()
  return now >= start && now <= end
}

/** Format ms as HH:MM:SS (hours may be > 24 for multi-day). */
function fmtHms(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const h   = Math.floor(totalSec / 3600)
  const m   = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

// BookingBadge removed: the small pending/confirmed/resigned pill used
// to sit at the top-right of every card and duplicated the full state
// banners (case ⑥ pending / case ④ confirmed / case ⑦ rejected). Users
// were seeing "Kutilmoqda" AND a "Bron qilish" button at the same time,
// which read as contradictory. Each state now renders exactly one full-
// width banner via the case chain in the render body.

/* ══════════════════════════════════════════════════════════════════════
   MockTestClient
   ══════════════════════════════════════════════════════════════════════ */
export function MockTestClient({ userId }: Props) {
  const { t } = useLanguage()
  const [schedules,     setSchedules]     = useState<MockScheduleWithBooking[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [modalSchedule, setModalSchedule] = useState<MockScheduleWithBooking | null>(null)

  // Realtime booking counts for every schedule on the page — one shared
  // channel, refetched on any mock_bookings change. `useMemo` stops the
  // hook's dep key from churning when React returns a fresh array each
  // render even if the ids didn't change.
  const scheduleIds = useMemo(() => schedules.map(s => s.id), [schedules])
  const bookingCounts = useAllBookingCounts(scheduleIds)

  // My-own bookings, keyed by schedule_id, updated in realtime — used
  // to overlay a "Rejected" banner + 5-minute cooldown timer when admin
  // hits Reject in Telegram. Falls back to `s.userBooking` from the
  // server payload when the hook hasn't populated yet.
  const myBookings = useMyBookings(scheduleIds, userId)

  // 1-second tick to keep countdowns live
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(tick => tick + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  // Track IDs we've already fired a resign request for (avoid duplicate calls)
  const resignedIds = useRef<Set<string>>(new Set())

  // Client-side auto-resign: fires when the 5-min cutoff passes while user is on page.
  // Belt-and-suspenders with server-side auto-resign in /api/mock/schedules.
  useEffect(() => {
    schedules.forEach(s => {
      if (!s.userBooking || s.userBooking.status !== 'confirmed') return
      if (s.submissionStatus) return // has a submission (draft/submitted/disqualified)
      if (resignedIds.current.has(s.id)) return

      const startMs = tashkentMs(s.date, s.time)
      if (Date.now() <= startMs + 5 * 60 * 1000) return

      // Mark so we don't fire again on the next tick
      resignedIds.current.add(s.id)

      fetch('/api/mock/resign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: s.userBooking.id, reason: 'Vaqtida kirmadi' }),
      }).then(() => {
        // Update local state immediately so the UI reflects resigned status
        setSchedules(prev =>
          prev.map(sc =>
            sc.id === s.id
              ? { ...sc, userBooking: { ...sc.userBooking!, status: 'resigned' } }
              : sc
          )
        )
      }).catch(err => console.error('[auto-resign] fetch error:', err))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, schedules])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const res = await fetch('/api/mock/schedules')
      if (res.ok) setSchedules(await res.json())
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime schedule updates. When an admin edits a schedule's time,
  // section files, or capacity, the browser tab needs to re-fetch so the
  // card reflects the change without a manual refresh. Uses the shared
  // supabase-realtime publication added in migration 031. One channel
  // per page, not per card — same pattern as the bookings subscription.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('mock_schedules_page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mock_schedules' },
        () => { void load(true) },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Refresh row */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('mock.upcomingSessions', { count: schedules.length })}
        </p>
        <button type="button" onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> {t('mock.refresh')}
        </button>
      </div>

      {/* Empty state */}
      {schedules.length === 0 && (
        <div className="card p-16 text-center">
          <Calendar size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
            {t('mock.noSessionsTitle')}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('mock.noSessionsDesc')}
          </p>
        </div>
      )}

      {/* Schedule cards */}
      <AnimatePresence>
        {schedules.map((s, i) => {
          // Prefer the realtime `my_bookings` row when present — it's
          // fresher than the initial server payload's `s.userBooking`
          // (which won't reflect an admin approve/reject that landed
          // after the page loaded). Server payload is the fallback for
          // the first render before the hook's fetch resolves.
          const liveBooking = myBookings[s.id]
          const bookingStatus =
            liveBooking?.status ?? s.userBooking?.status ?? null
          const bookingUpdatedAt = liveBooking?.updated_at ?? null

          const confirmed     = bookingStatus === 'confirmed'
          const pending       = bookingStatus === 'pending'
          const resigned      = bookingStatus === 'resigned'
          const rejected      = bookingStatus === 'rejected' || bookingStatus === 'cancelled'

          // Cooldown after rejection: 5-minute window anchored to
          // updated_at (set by the trigger in migration 032 the moment
          // status flipped). msLeft ticks down thanks to the parent
          // `tick` state; when it hits 0 the banner disappears and the
          // Book button becomes clickable again.
          const rejectedAtMs = rejected && bookingUpdatedAt
            ? new Date(bookingUpdatedAt).getTime()
            : null
          const cooldownEndMs = rejectedAtMs !== null ? rejectedAtMs + REJECT_COOLDOWN_MS : 0
          const cooldownRemainingMs = rejected && cooldownEndMs
            ? Math.max(0, cooldownEndMs - Date.now())
            : 0
          const inCooldown = cooldownRemainingMs > 0
          const cooldownMm = Math.floor(cooldownRemainingMs / 60000)
          const cooldownSs = Math.floor((cooldownRemainingMs % 60000) / 1000)
          const cooldownTimeStr = `${cooldownMm}:${String(cooldownSs).padStart(2, '0')}`
          void tick // ensure re-render every second while cooldown is live

          // "Has an active booking" for the action-column state machine:
          // pending/confirmed/resigned always count; rejected/cancelled
          // only count while the cooldown is still ticking, after which
          // the user can submit a new request and the row is treated as
          // if it never existed.
          const hasActiveBooking =
            (bookingStatus !== null && bookingStatus !== 'rejected' && bookingStatus !== 'cancelled')
            || (rejected && inCooldown)

          const disqualified  = s.submissionStatus === 'disqualified'
          const live          = isTestLive(s)
          const msLeft        = msUntilTest(s)          // ms to test start
          const tooLateToBook = msLeft < 5 * 60 * 1000 // < 5 min until start (or already started)
          const hasReading  = !!s.reading_file_url
          const hasListening = !!s.listening_file_url
          const hasWriting  = !!(s.writing_task1_topic || s.writing_task2_topic)

          // Capacity math: unlimited when capacity is null. Booked = live
          // count from useAllBookingCounts (RPC-backed so it aggregates
          // across all users, not just auth.uid()). Remaining clamped to
          // zero. Three UI tiers:
          //   full      → red, no pulse (nothing to hurry about)
          //   urgent    → red, pulse ring, "Only N left!" copy (≤10)
          //   warning   → amber, no pulse (11..20)
          //   available → emerald (>20)
          // The card is not shown at all unless a card should render, so
          // these flags are safe to derive unconditionally.
          const capacity = s.capacity
          const isUnlimited = capacity === null || capacity === undefined
          const booked = bookingCounts[s.id] ?? 0
          const seatsRemaining = isUnlimited ? null : Math.max(0, (capacity as number) - booked)
          const isFull = !isUnlimited && seatsRemaining === 0
          const isUrgent = !isUnlimited && seatsRemaining !== null && seatsRemaining > 0 && seatsRemaining <= 10
          const isWarning = !isUnlimited && seatsRemaining !== null && seatsRemaining > 10 && seatsRemaining <= 20

          return (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card overflow-hidden"
              style={{
                border: disqualified
                  ? '1px solid rgba(239,68,68,0.35)'
                  : confirmed
                    ? '1px solid rgba(34,197,94,0.35)'
                    : '1px solid var(--border)',
              }}>

              {/* ── Seats-remaining banner — top of card, prominent.
                  Hidden for unlimited sessions. Urgent tier (≤10) uses
                  a red pill with a pulsing dot and an ⚠ prefix so
                  users glance up and see it before anything else. */}
              {!isUnlimited && (
                <div className="px-5 pt-5">
                  <span
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${isUrgent ? 'animate-pulse' : ''}`}
                    style={{
                      background: isFull
                        ? 'rgba(239,68,68,0.15)'
                        : isUrgent
                          ? 'rgba(239,68,68,0.15)'
                          : isWarning
                            ? 'rgba(245,158,11,0.15)'
                            : 'rgba(16,185,129,0.15)',
                      color: isFull
                        ? 'var(--error)'
                        : isUrgent
                          ? 'var(--error)'
                          : isWarning
                            ? 'var(--warning)'
                            : 'var(--success)',
                      border: `1px solid ${
                        isFull ? 'rgba(239,68,68,0.4)'
                        : isUrgent ? 'rgba(239,68,68,0.4)'
                        : isWarning ? 'rgba(245,158,11,0.4)'
                        : 'rgba(16,185,129,0.3)'
                      }`,
                      boxShadow: isUrgent ? '0 4px 20px rgba(239,68,68,0.15)' : undefined,
                    }}
                  >
                    {/* Coloured dot + optional ping animation on the
                        urgent tier so the eye catches the card. */}
                    <span className="relative inline-flex w-2 h-2">
                      {isUrgent && (
                        <span
                          className="absolute inline-flex h-full w-full rounded-full animate-ping"
                          style={{ background: 'rgba(239,68,68,0.6)' }}
                        />
                      )}
                      <span
                        className="relative inline-flex rounded-full w-2 h-2"
                        style={{
                          background: isFull
                            ? '#ef4444'
                            : isUrgent
                              ? '#ef4444'
                              : isWarning
                                ? '#f59e0b'
                                : '#10b981',
                        }}
                      />
                    </span>
                    {isFull
                      ? <><Users size={13} /> {t('mockTest.full')}</>
                      : isUrgent
                        ? <><AlertTriangle size={13} /> {t('mockTest.hurryUp', { count: seatsRemaining as number })}</>
                        : <><Users size={13} /> {t('mockTest.seatsLeft', { count: seatsRemaining as number })}</>}
                  </span>
                </div>
              )}

              <div className="p-5 flex flex-wrap items-start justify-between gap-4">
                {/* ── Left: date badge + info ── */}
                <div className="flex items-start gap-4">
                  {/* Date badge */}
                  <div className="shrink-0 w-16 rounded-2xl text-center py-2.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                      {new Date(s.date + 'T00:00').toLocaleString('en', { month: 'short' })}
                    </div>
                    <div className="text-2xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {new Date(s.date + 'T00:00').getDate()}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(s.date + 'T00:00').toLocaleString('en', { weekday: 'short' })}
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                      {t('mock.title')}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={13} /> {formatTime(s.time)} &middot; {formatDisplayDate(s.date)}
                    </div>

                    {/* Section chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Reading',   has: hasReading,   bg: 'rgba(99,102,241,0.1)',  c: 'var(--accent)',  bc: 'rgba(99,102,241,0.25)',  Icon: BookOpen   },
                        { label: 'Listening', has: hasListening, bg: 'rgba(16,185,129,0.1)',  c: 'var(--success)', bc: 'rgba(16,185,129,0.25)',  Icon: Headphones },
                        { label: 'Writing',   has: hasWriting,   bg: 'rgba(245,158,11,0.1)',  c: 'var(--warning)', bc: 'rgba(245,158,11,0.25)',  Icon: PenTool    },
                      ].map(({ label, has, bg, c, bc, Icon }) => (
                        <span key={label}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: has ? bg : 'rgba(100,116,139,0.08)',
                            color: has ? c : 'var(--text-muted)',
                            border: `1px solid ${has ? bc : 'rgba(100,116,139,0.15)'}`,
                          }}>
                          <Icon size={10} /> {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Right: action-only column ──
                    Layout responsibility split from the state message:
                    the right column now carries only WHAT THE USER CAN
                    DO (Start Test, Book, disabled Full label). The
                    ambient state ("pending", "confirmed", "rejected")
                    lives in the full-width banner section below, so a
                    user can't get a small badge and a contradictory
                    button side by side any more. */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {disqualified ? (
                    <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold max-w-[200px] text-right"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <Ban size={13} className="shrink-0 mt-0.5" />
                      {t('mock.disqualified')}
                    </div>
                  ) : s.isSubmitted ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <PartyPopper size={14} /> {t('mock.submitted')}
                    </div>
                  ) : confirmed && live ? (
                    <>
                      {/* Inline 5-min warning stays adjacent to the Start
                          Test button — it's actionable context (hurry!),
                          not an ambient status message, so it belongs
                          next to the CTA rather than in the body banner. */}
                      {(() => {
                        const minsElapsed = Math.max(0, Math.floor(-msLeft / 60_000))
                        return (
                          <div
                            className="px-3 py-2.5 rounded-xl text-xs leading-snug max-w-[220px] text-right"
                            style={{
                              background: 'rgba(245,158,11,0.1)',
                              border: '1px solid rgba(245,158,11,0.4)',
                              color: 'var(--warning)',
                            }}
                          >
                            {minsElapsed === 0
                              ? <>
                                  <span className="font-bold block mb-0.5">{t('mock.testStarted')}</span>
                                  {t('mock.fiveMinWarning')}
                                </>
                              : <>
                                  <span className="font-bold block mb-0.5">{t('mock.minutesWarning')}</span>
                                  {t('mock.minutesElapsed', { n: minsElapsed, remaining: Math.max(1, 5 - minsElapsed) })}
                                </>
                            }
                          </div>
                        )
                      })()}
                      <Link href={`/mock-test/${s.id}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                        style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
                        <ArrowRight size={14} /> {t('mock.startMockTest')}
                      </Link>
                    </>
                  ) : confirmed && tooLateToBook && !live ? (
                    <p className="text-xs leading-snug max-w-[200px] text-right"
                      style={{ color: 'var(--text-muted)' }}>
                      {t('mock.autoResigned')}
                    </p>
                  ) : resigned ? (
                    <p className="text-xs leading-snug max-w-[200px] text-right"
                      style={{ color: 'var(--text-muted)' }}>
                      {t('mock.autoResigned')}
                    </p>
                  ) : !hasActiveBooking && tooLateToBook ? (
                    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-center"
                      style={{ background: 'rgba(100,116,139,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(100,116,139,0.2)' }}>
                      {t('mock.timePassed')}
                    </div>
                  ) : !hasActiveBooking && isFull ? (
                    <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-center font-semibold"
                      style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <Users size={12} /> {t('mockTest.full')}
                    </div>
                  ) : !hasActiveBooking ? (
                    <button type="button" onClick={() => setModalSchedule(s)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background: 'var(--accent)' }}>
                      <CreditCard size={14} /> {t('mock.bookSession')}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* ── Full-width state banner ────────────────────────────
                  Sits outside the main flex row so it spans the whole
                  card. Exactly one banner renders at a time; the outer
                  card only pays vertical space when there's actually
                  a banner to show. */}
              {pending && (
                <div className="px-5 pb-5">
                  <div
                    className="rounded-2xl p-4 space-y-2"
                    style={{
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.35)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={20} style={{ color: 'var(--warning)' }} />
                      <h4 className="font-bold text-base" style={{ color: 'var(--warning)' }}>
                        {t('mockTest.pendingTitle')}
                      </h4>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {t('mockTest.pendingMessage')}
                    </p>
                  </div>
                </div>
              )}

              {confirmed && msLeft > 0 && !live && (
                <div className="px-5 pb-5">
                  <div
                    className="rounded-2xl p-4 space-y-3"
                    style={{
                      background: 'rgba(34,197,94,0.08)',
                      border: '1px solid rgba(34,197,94,0.35)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                      <h4 className="font-bold text-base" style={{ color: 'var(--success)' }}>
                        {t('mockTest.confirmedTitle')}
                      </h4>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {t('mockTest.confirmedMessage')}
                    </p>
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{
                        background: 'rgba(34,197,94,0.05)',
                        border: '1px solid rgba(34,197,94,0.2)',
                      }}
                    >
                      <Clock size={14} style={{ color: 'var(--success)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('mock.timeUntilTest')}
                      </span>
                      <span
                        className="font-mono font-bold text-lg tabular-nums ml-auto"
                        style={{ color: 'var(--success)' }}
                      >
                        {fmtHms(msLeft)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {rejected && inCooldown && (
                <div className="px-5 pb-5">
                  <div
                    className="rounded-2xl p-4 space-y-3"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.35)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <XCircle size={20} style={{ color: 'var(--error)' }} />
                      <h4 className="font-bold text-base" style={{ color: 'var(--error)' }}>
                        {t('mockTest.requestRejected')}
                      </h4>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {t('mockTest.rejectedMessage')}
                    </p>
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{
                        background: 'rgba(239,68,68,0.05)',
                        border: '1px solid rgba(239,68,68,0.2)',
                      }}
                    >
                      <Clock size={14} style={{ color: 'var(--error)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('mockTest.cooldownRemaining')}:
                      </span>
                      <span
                        className="font-mono font-bold text-lg tabular-nums ml-auto"
                        style={{ color: 'var(--error)' }}
                      >
                        {cooldownTimeStr}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Info box */}
      <div className="rounded-2xl p-4 text-sm"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <p className="font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>ℹ️ {t('mock.infoTitle')}</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>{t('mock.infoItem1')}</li>
          <li>{t('mock.infoItem2')}</li>
          <li>{t('mock.infoItem3')}</li>
          <li>{t('mock.infoItem4')}</li>
          <li>{t('mock.infoItem5')}</li>
        </ul>
      </div>

      {/* Payment modal */}
      {modalSchedule && (
        <PaymentModal
          isOpen={!!modalSchedule}
          onClose={() => setModalSchedule(null)}
          onSuccess={() => { setModalSchedule(null); load(true) }}
          type="mock_booking"
          amount={20000}
          meta={{
            booking_date: modalSchedule.date,
            time_slot: modalSchedule.time.slice(0, 5),
            schedule_id: modalSchedule.id,
          }}
        />
      )}
    </div>
  )
}
