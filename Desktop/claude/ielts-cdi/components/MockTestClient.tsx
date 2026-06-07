'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Calendar, Clock, CheckCircle, CreditCard, BookOpen,
  Headphones, PenTool, AlertCircle, ArrowRight, Loader2, RefreshCw,
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
  userBooking: { status: string; payment_status: string } | null
}

interface Props {
  userId: string
}

/* ── Date / time helpers ─────────────────────────────────────────────── */
function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', weekday: 'long' })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':')
  const hour   = parseInt(h)
  const ampm   = hour >= 12 ? 'PM' : 'AM'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${String(display).padStart(2, '0')}:${m} ${ampm}`
}

/** Returns ms until the test window opens (test start − 30 min).
 *  Returns 0 if already open, negative if in the past. */
function msUntilWindow(schedule: MockScheduleWithBooking): number {
  const testDt     = new Date(`${schedule.date}T${schedule.time}`)
  const windowOpen = new Date(testDt.getTime() - 30 * 60 * 1000)
  return windowOpen.getTime() - Date.now()
}

/** True while we are in the 30-min-before → 4-hour-after window. */
function isTestAvailable(schedule: MockScheduleWithBooking) {
  const testDt = new Date(`${schedule.date}T${schedule.time}`)
  const start  = new Date(testDt.getTime() - 30 * 60 * 1000)
  const end    = new Date(testDt.getTime() + 4 * 60 * 60 * 1000)
  const now    = new Date()
  return now >= start && now <= end
}

/** Format a millisecond duration as HH:MM:SS or MM:SS. */
function fmtCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.ceil(ms / 1000))
  const h   = Math.floor(totalSecs / 3600)
  const m   = Math.floor((totalSecs % 3600) / 60)
  const sec = totalSecs % 60
  if (h > 0) return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
  return [m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

/* ── Badge ───────────────────────────────────────────────────────────── */
function BookingBadge({ booking }: { booking: MockScheduleWithBooking['userBooking'] }) {
  if (!booking) return null
  if (booking.status === 'confirmed') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>
      <CheckCircle size={11} /> Tasdiqlangan
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}>
      <Clock size={11} /> Kutilmoqda
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MockTestClient
   ═══════════════════════════════════════════════════════════════════════ */
export function MockTestClient({ userId }: Props) {
  const [schedules, setSchedules]     = useState<MockScheduleWithBooking[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [modalSchedule, setModalSchedule] = useState<MockScheduleWithBooking | null>(null)
  // Tick every second to keep countdowns live
  const [, setTick] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/mock/schedules')
      if (res.ok) setSchedules(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleBookSuccess = () => {
    setModalSchedule(null)
    load(true)
  }

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
          {schedules.length} ta kelgusi seans mavjud
        </p>
        <button onClick={() => load(true)} disabled={refreshing}
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
            Admin yangi Mock Test seanslarini rejalashtirganida bu yerda ko&apos;rsatiladi.
          </p>
        </div>
      )}

      {/* Schedule cards */}
      <AnimatePresence>
        {schedules.map((s, i) => {
          const available  = isTestAvailable(s)
          const confirmed  = s.userBooking?.status === 'confirmed'
          const pending    = s.userBooking?.status === 'pending'
          const hasReading  = !!s.reading_file_url
          const hasListening = !!s.listening_file_url
          const hasWriting  = !!(s.writing_task1_topic || s.writing_task2_topic)

          // Countdown until window opens (only relevant for confirmed + not yet available)
          const msLeft = msUntilWindow(s)
          const showCountdown = confirmed && !available && msLeft > 0

          return (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card overflow-hidden"
              style={{ border: confirmed ? '1px solid rgba(34,197,94,0.35)' : '1px solid var(--border)' }}>

              <div className="p-5 flex flex-wrap items-start justify-between gap-4">
                {/* Left: date badge + info */}
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
                        { label: 'Reading',   has: hasReading,   bg: 'rgba(99,102,241,0.1)',  c: 'var(--accent)',   bc: 'rgba(99,102,241,0.25)',  Icon: BookOpen },
                        { label: 'Listening', has: hasListening, bg: 'rgba(16,185,129,0.1)',  c: 'var(--success)',  bc: 'rgba(16,185,129,0.25)',  Icon: Headphones },
                        { label: 'Writing',   has: hasWriting,   bg: 'rgba(245,158,11,0.1)',  c: 'var(--warning)',  bc: 'rgba(245,158,11,0.25)',  Icon: PenTool },
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

                {/* Right: status badge + action */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <BookingBadge booking={s.userBooking} />

                  {/* ── Action area ── */}
                  {confirmed && available ? (
                    /* Test window is open — show Start button */
                    <Link href={`/mock-test/${s.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
                      <ArrowRight size={14} /> Mock Test boshlash
                    </Link>

                  ) : showCountdown ? (
                    /* Countdown until test window opens */
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-mono font-bold text-lg tabular-nums"
                        style={{ color: 'var(--text-primary)' }}>
                        {fmtCountdown(msLeft)}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        testgacha
                      </div>
                    </div>

                  ) : confirmed ? (
                    /* Confirmed but far future — no countdown */
                    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      <Clock size={12} /> Test vaqtida ochiladi
                    </div>

                  ) : pending ? (
                    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      <AlertCircle size={12} /> Admin tasdiqlashini kuting
                    </div>

                  ) : (
                    <button onClick={() => setModalSchedule(s)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
                      style={{ background: 'var(--accent)' }}>
                      <CreditCard size={14} /> Bron qilish — 20,000 UZS
                    </button>
                  )}
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
          <li>Test boshlanishidan 30 daqiqa oldin &quot;Mock Test boshlash&quot; tugmasi paydo bo&apos;ladi</li>
          <li>Test: Listening (40 min) + Reading (60 min) + Writing (60 min)</li>
          <li>Narx: 20,000 UZS</li>
        </ul>
      </div>

      {/* Payment modal */}
      {modalSchedule && (
        <PaymentModal
          isOpen={!!modalSchedule}
          onClose={() => setModalSchedule(null)}
          onSuccess={handleBookSuccess}
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
