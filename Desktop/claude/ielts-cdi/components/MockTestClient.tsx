'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Calendar, Clock, CheckCircle, CreditCard, BookOpen,
  Headphones, PenTool, AlertCircle, ArrowRight, Loader2,
  RefreshCw, PartyPopper, XCircle, Ban,
} from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'

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

/* ── Badges ──────────────────────────────────────────────────────────── */
function BookingBadge({ booking }: { booking: MockScheduleWithBooking['userBooking'] }) {
  if (!booking) return null
  if (booking.status === 'confirmed') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>
      <CheckCircle size={11} /> Tasdiqlangan
    </span>
  )
  if (booking.status === 'resigned') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
      <XCircle size={11} /> Vaqtida kirmadi
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}>
      <Clock size={11} /> Kutilmoqda
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   MockTestClient
   ══════════════════════════════════════════════════════════════════════ */
export function MockTestClient({ userId }: Props) {
  const [schedules,     setSchedules]     = useState<MockScheduleWithBooking[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [modalSchedule, setModalSchedule] = useState<MockScheduleWithBooking | null>(null)

  // 1-second tick to keep countdowns live
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000)
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

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true)
    try {
      const res = await fetch('/api/mock/schedules')
      if (res.ok) setSchedules(await res.json())
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

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
          {schedules.length} ta kelgusi seans
        </p>
        <button type="button" onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      {/* Empty state */}
      {schedules.length === 0 && (
        <div className="card p-16 text-center">
          <Calendar size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
            Hozircha mavjud seanslar yo&apos;q
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Admin yangi seans qo&apos;shganda bu yerda ko&apos;rsatiladi.
          </p>
        </div>
      )}

      {/* Schedule cards */}
      <AnimatePresence>
        {schedules.map((s, i) => {
          const confirmed     = s.userBooking?.status === 'confirmed'
          const pending       = s.userBooking?.status === 'pending'
          const resigned      = s.userBooking?.status === 'resigned'
          const disqualified  = s.submissionStatus === 'disqualified'
          const live          = isTestLive(s)
          const msLeft        = msUntilTest(s)          // ms to test start
          const tooLateToBook = msLeft < 5 * 60 * 1000 // < 5 min until start (or already started)
          const hasReading  = !!s.reading_file_url
          const hasListening = !!s.listening_file_url
          const hasWriting  = !!(s.writing_task1_topic || s.writing_task2_topic)

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
                      Mock IELTS Test
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

                {/* ── Right: status + action ── */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <BookingBadge booking={s.userBooking} />

                  {/* ① Disqualified — permanently blocked */}
                  {disqualified ? (
                    <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold max-w-[200px] text-right"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <Ban size={13} className="shrink-0 mt-0.5" />
                      Chetlatilgansiz. Sabab: Qoidabuzarlik (3x ogohlantirish)
                    </div>

                  /* ② Submitted — test successfully done */
                  ) : s.isSubmitted ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <PartyPopper size={14} /> Test topshirildi ✅
                    </div>

                  /* ③ Confirmed + test is live → Start button */
                  ) : confirmed && live ? (
                    <Link href={`/mock-test/${s.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
                      <ArrowRight size={14} /> Mock Test boshlash
                    </Link>

                  /* ④ Confirmed + countdown active (test not yet started) */
                  ) : confirmed && msLeft > 0 ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Testgacha:
                      </div>
                      <div className="font-mono font-bold text-lg tabular-nums"
                        style={{ color: 'var(--accent)' }}>
                        {fmtHms(msLeft)}
                      </div>
                    </div>

                  /* ⑤ Confirmed + late (>5 min past start, no submission) */
                  ) : confirmed && tooLateToBook && !live ? (
                    <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold max-w-[200px] text-right"
                      style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <XCircle size={13} className="shrink-0 mt-0.5" />
                      Vaqtida kirmagansiz. 5 daqiqadan ko&apos;p kech qoldingiz.
                    </div>

                  /* ⑥ Pending (awaiting admin approval) */
                  ) : pending ? (
                    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <AlertCircle size={12} /> Admin tasdiqlashini kuting
                    </div>

                  /* ⑦ Resigned — did not show up */
                  ) : resigned ? (
                    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      ❌ Vaqtida kirmadi
                    </div>

                  /* ⑧ No booking + too late → show message */
                  ) : !s.userBooking && tooLateToBook ? (
                    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-center"
                      style={{ background: 'rgba(100,116,139,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(100,116,139,0.2)' }}>
                      Vaqt o&apos;tib ketdi. Keyingi seansni tanlang
                    </div>

                  /* ⑨ No booking → Book button */
                  ) : !s.userBooking ? (
                    <button type="button" onClick={() => setModalSchedule(s)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background: 'var(--accent)' }}>
                      <CreditCard size={14} /> Bron qilish — 20,000 UZS
                    </button>

                  ) : null}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Info box */}
      <div className="rounded-2xl p-4 text-sm"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <p className="font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>ℹ️ Mock Test haqida</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Bron qilgach, 24 soat ichida admin tasdiqlaydi</li>
          <li>Test vaqti kelganda &quot;Mock Test boshlash&quot; tugmasi paydo bo&apos;ladi</li>
          <li>Test: Listening (40 min) + Reading (60 min) + Writing (60 min)</li>
          <li>Narx: 20,000 UZS</li>
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
