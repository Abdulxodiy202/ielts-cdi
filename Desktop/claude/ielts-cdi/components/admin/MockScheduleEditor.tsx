'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, Calendar, Clock, Upload, Trash2,
  Image as ImageIcon, Edit2, Loader2, X, CheckCircle,
  BookOpen, Headphones, PenTool, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, FileText, Crown, Users, Phone, Mail, User,
} from 'lucide-react'

/* ─────────────────────────── Types ──────────────────────────────────── */
export interface MockSchedule {
  id: string
  date: string
  time: string
  status: 'scheduled' | 'active' | 'completed'
  reading_file_url:        string | null
  listening_file_url:      string | null
  writing_task1_image_url: string | null
  writing_task1_topic:     string | null
  writing_task2_topic:     string | null
  created_at: string
}

type FileField = 'reading' | 'listening' | 'writing_task1'

interface MockSubmission {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_phone: string
  is_premium: boolean
  schedule_date: string | null
  schedule_time: string | null
  listening_answers: Record<string, string>
  reading_answers: Record<string, string>
  writing_task1: string
  writing_task2: string
  status: string
  submitted_at: string | null
}

interface MockBooking {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_phone: string
  is_premium: boolean
  status: string
  payment_status: string
  created_at: string
}

interface FormState {
  id: string
  date: string
  time: string
  status: 'scheduled' | 'active' | 'completed'
  reading_file_url:        string | null
  listening_file_url:      string | null
  writing_task1_image_url: string | null
  writing_task1_topic:     string
  writing_task2_topic:     string
}

/* ─────────────────────────── Helpers ───────────────────────────────── */
function makeEmpty(): FormState {
  return {
    id:                      crypto.randomUUID(),
    date:                    '',
    time:                    '09:00',
    status:                  'scheduled',
    reading_file_url:        null,
    listening_file_url:      null,
    writing_task1_image_url: null,
    writing_task1_topic:     '',
    writing_task2_topic:     '',
  }
}

function scheduleToForm(s: MockSchedule): FormState {
  return {
    id:                      s.id,
    date:                    s.date,
    time:                    s.time,
    status:                  s.status,
    reading_file_url:        s.reading_file_url,
    listening_file_url:      s.listening_file_url,
    writing_task1_image_url: s.writing_task1_image_url,
    writing_task1_topic:     s.writing_task1_topic ?? '',
    writing_task2_topic:     s.writing_task2_topic ?? '',
  }
}

function statusCfg(s: string) {
  return ({
    scheduled: { label: 'Rejalashtirilgan', bg: 'rgba(99,102,241,0.12)', color: 'var(--accent)',    border: 'rgba(99,102,241,0.3)' },
    active:    { label: 'Faol',             bg: 'rgba(34,197,94,0.12)',  color: 'var(--success)',   border: 'rgba(34,197,94,0.3)' },
    completed: { label: 'Yakunlangan',      bg: 'rgba(100,116,139,0.12)',color: 'var(--text-muted)',border: 'rgba(100,116,139,0.3)' },
  } as Record<string, { label: string; bg: string; color: string; border: string }>)[s]
    ?? { label: s, bg: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'var(--border)' }
}

function fileLabel(url: string | null) {
  if (!url) return null
  return decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '')
}

/** Format a Date as YYYY-MM-DD in local time (avoids UTC offset shift). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa']

/* ═══════════════════════════════════════════════════════════════════════
   CalendarPicker
   ══════════════════════════════════════════════════════════════════════ */
interface CalendarPickerProps {
  value: string           // "YYYY-MM-DD" or ""
  onChange: (date: string) => void
  scheduledDates: Set<string>  // dates that already have schedules
}

function CalendarPicker({ value, onChange, scheduledDates }: CalendarPickerProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toLocalDateStr(today)

  // Initialise view to selected month, or current month
  const initDate = value ? new Date(value + 'T00:00') : today
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initDate.getMonth())

  // Sync view when user opens a different schedule to edit
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build grid: leading nulls + day numbers
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()   // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null)

  const cellDateStr = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${viewYear}-${m}-${d}`
  }

  return (
    <div
      className="rounded-2xl p-4 select-none"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <ChevronLeft size={16} />
        </button>

        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map(d => (
          <div
            key={d}
            className="h-8 flex items-center justify-center text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Day cells ── */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="h-9" />

          const dateStr    = cellDateStr(day)
          const isSelected  = dateStr === value
          const isToday     = dateStr === todayStr
          const isScheduled = scheduledDates.has(dateStr) && dateStr !== value
          const isPast      = dateStr < todayStr

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange(dateStr)}
              className="relative h-9 w-full flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all"
              style={{
                background: isSelected
                  ? 'var(--accent)'
                  : isToday
                    ? 'rgba(99,102,241,0.10)'
                    : isScheduled
                      ? 'rgba(245,158,11,0.10)'
                      : 'transparent',
                color: isSelected
                  ? '#fff'
                  : isPast && !isToday
                    ? 'var(--text-muted)'
                    : 'var(--text-primary)',
                // Ring for today (when not selected)
                outline: isToday && !isSelected ? '2px solid var(--accent)' : 'none',
                outlineOffset: '-2px',
                fontWeight: isSelected || isToday ? 700 : 500,
                opacity: isPast && !isToday && !isSelected ? 0.55 : 1,
              }}
            >
              {day}

              {/* Amber dot for dates that already have a schedule */}
              {isScheduled && (
                <span
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: 'var(--warning)' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="w-3 h-3 rounded-full" style={{ background: 'var(--accent)', display: 'inline-block' }} />
          Tanlangan
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="w-3 h-3 rounded-full border-2" style={{ borderColor: 'var(--accent)', display: 'inline-block' }} />
          Bugun
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="w-3 h-3 rounded-full" style={{ background: 'rgba(245,158,11,0.4)', display: 'inline-block' }} />
          Rejalashtirilgan
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   FileUploadField
   ══════════════════════════════════════════════════════════════════════ */
interface FileUploadFieldProps {
  label: string
  icon: React.ReactNode
  accept: string
  currentUrl: string | null
  uploading: boolean
  onFile: (f: File) => void
  onClear: () => void
}

function FileUploadField({ label, icon, accept, currentUrl, uploading, onFile, onClear }: FileUploadFieldProps) {
  const ref = useRef<HTMLInputElement>(null)
  const name = fileLabel(currentUrl)

  return (
    <div>
      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        {icon} {label}
      </p>

      {name ? (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
        >
          <CheckCircle size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <a
            href={currentUrl ?? '#'} target="_blank" rel="noopener noreferrer"
            className="flex-1 min-w-0 truncate hover:underline text-xs"
            style={{ color: 'var(--success)' }}
          >
            {name}
          </a>
          <button type="button" onClick={onClear}
            className="p-0.5 rounded shrink-0" style={{ color: 'var(--text-muted)' }}>
            <X size={13} />
          </button>
          <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
            className="shrink-0 text-xs px-2 py-0.5 rounded-lg"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {uploading ? <Loader2 size={11} className="animate-spin" /> : 'Almashtirish'}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
          style={{
            border: '2px dashed var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading
            ? <><Loader2 size={14} className="animate-spin" /> Yuklanmoqda…</>
            : <><Upload size={14} /> Fayl tanlang</>}
        </button>
      )}

      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   SubmissionCard — one candidate's full submission details
   ══════════════════════════════════════════════════════════════════════ */
function AnswersTable({ answers: rawAnswers, label, color }: {
  answers: Record<string, string> | string | null | undefined
  label: string
  color: string
}) {
  // Defensive: JSONB might arrive as a JSON string in some edge cases
  const answers: Record<string, string> =
    typeof rawAnswers === 'string'
      ? (() => { try { return JSON.parse(rawAnswers) } catch { return {} } })()
      : (rawAnswers ?? {})

  const entries = Object.entries(answers).sort(([a], [b]) => Number(a) - Number(b))
  if (entries.length === 0) {
    return (
      <div>
        <p className="text-xs font-bold mb-2" style={{ color }}>{label}</p>
        <p className="text-xs px-3 py-2 rounded-lg"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          Javob topshirilmagan
        </p>
      </div>
    )
  }
  const answeredCount = entries.filter(([, val]) => Boolean(val && val.trim())).length
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold" style={{ color }}>{label}</p>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
          {answeredCount} / {entries.length} savolga javob berildi
        </span>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="grid text-xs font-semibold px-3 py-1.5"
          style={{ gridTemplateColumns: '48px 1fr', background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          <span>#</span><span>Javob</span>
        </div>
        {entries.map(([q, ans]) => (
          <div key={q} className="grid text-xs px-3 py-1.5 border-b last:border-b-0"
            style={{ gridTemplateColumns: '48px 1fr', borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{q}</span>
            <span style={{ color: 'var(--text-primary)' }}>{ans || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubmissionCard({ sub, index, task1ImageUrl }: {
  sub: MockSubmission
  index: number
  task1ImageUrl?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const hasListening = Object.keys(sub.listening_answers ?? {}).length > 0
  const hasReading   = Object.keys(sub.reading_answers ?? {}).length > 0
  const hasWriting   = !!(sub.writing_task1 || sub.writing_task2)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Card header — candidate info */}
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors"
        style={{ background: open ? 'var(--bg-secondary)' : 'var(--bg-card)' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
          >
            {index}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {sub.user_name}
              </span>
              {sub.is_premium && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <Crown size={10} /> Premium
                </span>
              )}
              {sub.status === 'disqualified' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  🚫 Chetlatildi
                </span>
              )}
              {sub.status === 'resigned' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  ❌ Vaqtida kirmadi
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub.user_email}</span>
              {sub.user_phone && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub.user_phone}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1.5">
            {hasListening && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)' }}>
                L
              </span>
            )}
            {hasReading && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
                R
              </span>
            )}
            {hasWriting && (
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
                W
              </span>
            )}
          </div>
          {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 pt-3 space-y-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {/* Submitted at / status info */}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {sub.status === 'resigned'
              ? '❌ Foydalanuvchi vaqtida kirmadi (test boshlanganidan 5 daqiqa o\'tdi)'
              : sub.status === 'disqualified'
                ? `🚫 Chetlatildi${sub.submitted_at ? ` · ${new Date(sub.submitted_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`
                : sub.submitted_at
                  ? `Topshirildi: ${new Date(sub.submitted_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                  : 'Topshirilmagan (qoralama)'}
          </p>

          {/* Listening */}
          <AnswersTable
            answers={sub.listening_answers ?? {}}
            label="🎧 Listening javoblari"
            color="var(--success)"
          />

          {/* Reading */}
          <AnswersTable
            answers={sub.reading_answers ?? {}}
            label="📖 Reading javoblari"
            color="var(--accent)"
          />

          {/* Writing */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--warning)' }}>✍️ Writing</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Task 1</p>
                {task1ImageUrl && (
                  <button
                    type="button"
                    onClick={() => setLightbox(true)}
                    className="block w-full mb-2 rounded-xl overflow-hidden transition-opacity hover:opacity-90"
                    style={{ border: '1px solid var(--border)', cursor: 'zoom-in', maxHeight: 200 }}
                    title="Kattalashtirish uchun bosing"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={task1ImageUrl}
                      alt="Task 1 rasm"
                      className="w-full object-contain"
                      style={{ maxHeight: 200, background: 'var(--bg-card)' }}
                    />
                  </button>
                )}
                <pre className="text-xs whitespace-pre-wrap leading-relaxed p-3 rounded-xl"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', fontFamily: 'inherit', border: '1px solid var(--border)', minHeight: 48 }}>
                  {sub.writing_task1 || '(bo\'sh)'}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Task 2</p>
                <pre className="text-xs whitespace-pre-wrap leading-relaxed p-3 rounded-xl"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', fontFamily: 'inherit', border: '1px solid var(--border)', minHeight: 48 }}>
                  {sub.writing_task2 || '(bo\'sh)'}
                </pre>
              </div>
            </div>
          </div>

          {/* Lightbox */}
          {lightbox && task1ImageUrl && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
              onClick={() => setLightbox(false)}
            >
              <button
                type="button"
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
                onClick={e => { e.stopPropagation(); setLightbox(false) }}
              >
                <X size={18} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={task1ImageUrl}
                alt="Task 1 rasm (katta)"
                className="max-w-full max-h-full rounded-2xl shadow-2xl"
                style={{ objectFit: 'contain', userSelect: 'none' }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Natijani yuborish button */}
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
            }}
            onClick={() => alert('Natijani yuborish funksiyasi tez orada qo\'shiladi!')}
          >
            <CheckCircle size={15} />
            Natijani yuborish
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MockScheduleEditor
   ══════════════════════════════════════════════════════════════════════ */
export function MockScheduleEditor({ initialSchedules }: { initialSchedules: MockSchedule[] }) {
  const [schedules, setSchedules]       = useState<MockSchedule[]>(initialSchedules)
  const [showForm, setShowForm]         = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [form, setForm]                 = useState<FormState>(makeEmpty())
  const [saving, setSaving]             = useState(false)
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [message, setMessage]           = useState<{ ok: boolean; text: string } | null>(null)
  const [uploading, setUploading]       = useState<Partial<Record<FileField, boolean>>>({})
  const [modalScheduleId, setModalScheduleId] = useState<string | null>(null)
  const [modalSchedule, setModalSchedule]     = useState<MockSchedule | null>(null)
  const [modalSubmissions, setModalSubmissions] = useState<MockSubmission[]>([])
  const [modalLoading, setModalLoading]       = useState(false)

  const [bookingsModalId, setBookingsModalId]             = useState<string | null>(null)
  const [bookingsModalSchedule, setBookingsModalSchedule] = useState<MockSchedule | null>(null)
  const [bookingsData, setBookingsData]                   = useState<MockBooking[]>([])
  const [bookingsLoading, setBookingsLoading]             = useState(false)

  // All dates that have an existing schedule — used by CalendarPicker to show dots
  const scheduledDates = new Set(schedules.map(s => s.date))

  /* ── Open submissions modal for a schedule ── */
  const openModal = async (s: MockSchedule) => {
    setModalSchedule(s)
    setModalScheduleId(s.id)
    setModalSubmissions([])
    setModalLoading(true)
    try {
      const res = await fetch(`/api/admin/mock-submissions?scheduleId=${s.id}`)
      if (res.ok) {
        const data = await res.json()
        // Debug: log raw answer key counts so we can inspect what's actually in the DB
        console.log('[MockScheduleEditor] submissions raw:', data.map((sub: any) => ({
          id: sub.id,
          user: sub.user_name,
          listening_type: typeof sub.listening_answers,
          reading_type: typeof sub.reading_answers,
          listening_keys: sub.listening_answers ? Object.keys(typeof sub.listening_answers === 'string' ? JSON.parse(sub.listening_answers) : sub.listening_answers).length : 0,
          reading_keys: sub.reading_answers ? Object.keys(typeof sub.reading_answers === 'string' ? JSON.parse(sub.reading_answers) : sub.reading_answers).length : 0,
          listening_raw: sub.listening_answers,
          reading_raw: sub.reading_answers,
        })))
        setModalSubmissions(data)
      }
    } finally {
      setModalLoading(false)
    }
  }
  const closeModal = () => { setModalScheduleId(null); setModalSchedule(null); setModalSubmissions([]) }

  /* ── Open bookings modal for a schedule ── */
  const openBookingsModal = async (s: MockSchedule) => {
    setBookingsModalSchedule(s)
    setBookingsModalId(s.id)
    setBookingsData([])
    setBookingsLoading(true)
    try {
      const res = await fetch(`/api/admin/mock-bookings?scheduleId=${s.id}`)
      if (res.ok) setBookingsData(await res.json())
    } finally {
      setBookingsLoading(false)
    }
  }
  const closeBookingsModal = () => { setBookingsModalId(null); setBookingsModalSchedule(null); setBookingsData([]) }

  /* ── Form open / close ── */
  const openNew = () => {
    setForm(makeEmpty())
    setEditingId(null)
    setMessage(null)
    setShowForm(true)
  }
  const openEdit = (s: MockSchedule) => {
    setForm(scheduleToForm(s))
    setEditingId(s.id)
    setMessage(null)
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditingId(null); setMessage(null) }

  /* ── File upload ── */
  const handleFileUpload = async (file: File, field: FileField) => {
    setUploading(prev => ({ ...prev, [field]: true }))
    const fd = new FormData()
    fd.append('file', file)
    fd.append('scheduleId', form.id)
    fd.append('fileType', field)
    try {
      const res = await fetch('/api/admin/mock-upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        const key = field === 'reading' ? 'reading_file_url'
                  : field === 'listening' ? 'listening_file_url'
                  : 'writing_task1_image_url'
        setForm(prev => ({ ...prev, [key]: url }))
      } else {
        const err = await res.json()
        setMessage({ ok: false, text: err.error ?? 'Yuklash xatosi' })
      }
    } catch { setMessage({ ok: false, text: 'Tarmoq xatosi' }) }
    finally   { setUploading(prev => ({ ...prev, [field]: false })) }
  }

  const clearFile = (field: FileField) => {
    const key = field === 'reading' ? 'reading_file_url'
              : field === 'listening' ? 'listening_file_url'
              : 'writing_task1_image_url'
    setForm(prev => ({ ...prev, [key]: null }))
  }

  /* ── Save ── */
  const handleSave = async () => {
    if (!form.date || !form.time) {
      setMessage({ ok: false, text: 'Sana va vaqt kiritilishi shart' }); return
    }
    setSaving(true); setMessage(null)
    try {
      const res = await fetch('/api/admin/mock-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Xatolik')
      const saved = data as MockSchedule
      setSchedules(prev => {
        const idx = prev.findIndex(s => s.id === saved.id)
        return idx >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev]
      })
      setMessage({ ok: true, text: editingId ? 'O\'zgarishlar saqlandi!' : 'Yangi jadval yaratildi!' })
      setEditingId(saved.id)
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Xatolik' })
    } finally { setSaving(false) }
  }

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    setDeleting(id)
    setDeleteConfirmId(null)
    try {
      const res = await fetch(`/api/admin/mock-schedules/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSchedules(prev => prev.filter(s => s.id !== id))
        if (editingId === id) closeForm()
      }
    } finally { setDeleting(null) }
  }

  /* ── Render ── */
  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Mock Test Jadvali</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{schedules.length} jadval mavjud</p>
        </div>
        {!showForm && (
          <button onClick={openNew} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={15} /> Yangi jadval
          </button>
        )}
      </div>

      {/* ══ FORM ══════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="card p-6 space-y-6" style={{ border: '1px solid rgba(99,102,241,0.4)' }}>

          {/* Form header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {editingId ? 'Jadvalni tahrirlash' : 'Yangi jadval yaratish'}
            </h3>
            <button onClick={closeForm} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>

          {/* ── Calendar date picker ── */}
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={12} /> Sanani tanlang
              {form.date && (
                <span className="ml-auto font-bold text-sm" style={{ color: 'var(--accent)' }}>
                  {form.date}
                </span>
              )}
            </p>
            <CalendarPicker
              value={form.date}
              onChange={date => { setForm(p => ({ ...p, date })); setMessage(null) }}
              scheduledDates={scheduledDates}
            />
          </div>

          {/* ── Time + Status row ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}>
                <Clock size={12} /> Vaqt
              </label>
              <input type="time" className="input-field" value={form.time}
                onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Holat
              </label>
              <select className="input-field" value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as FormState['status'] }))}>
                <option value="scheduled">Rejalashtirilgan</option>
                <option value="active">Faol</option>
                <option value="completed">Yakunlangan</option>
              </select>
            </div>
          </div>

          {/* ── File uploads ── */}
          <div className="rounded-xl p-4 space-y-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Fayl yuklash
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <FileUploadField
                label="Reading (HTML / PDF)" icon={<BookOpen size={12} />} accept=".html,.htm,.pdf"
                currentUrl={form.reading_file_url} uploading={!!uploading.reading}
                onFile={f => handleFileUpload(f, 'reading')} onClear={() => clearFile('reading')}
              />
              <FileUploadField
                label="Listening (MP3 / WAV / ZIP)" icon={<Headphones size={12} />} accept=".mp3,.wav,.ogg,.m4a,.zip"
                currentUrl={form.listening_file_url} uploading={!!uploading.listening}
                onFile={f => handleFileUpload(f, 'listening')} onClear={() => clearFile('listening')}
              />
            </div>
          </div>

          {/* ── Writing section ── */}
          <div className="rounded-xl p-4 space-y-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Writing bo&apos;limi
            </p>

            {/* Task 1 */}
            <div className="space-y-3">
              <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <PenTool size={12} /> Task 1
              </p>
              <FileUploadField
                label="Rasm (JPG / PNG / WEBP)" icon={<ImageIcon size={12} />}
                accept=".jpg,.jpeg,.png,.webp,.gif"
                currentUrl={form.writing_task1_image_url} uploading={!!uploading.writing_task1}
                onFile={f => handleFileUpload(f, 'writing_task1')} onClear={() => clearFile('writing_task1')}
              />
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Task 1 topshirig&apos;i (matn)
                </label>
                <textarea className="input-field text-sm resize-none" rows={3}
                  placeholder="The chart below shows… Describe what you see."
                  value={form.writing_task1_topic}
                  onChange={e => setForm(p => ({ ...p, writing_task1_topic: e.target.value }))} />
              </div>
            </div>

            {/* Task 2 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <PenTool size={12} /> Task 2
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Task 2 topshirig&apos;i (matn)
                </label>
                <textarea className="input-field text-sm resize-none" rows={4}
                  placeholder="Some people believe that… To what extent do you agree or disagree?"
                  value={form.writing_task2_topic}
                  onChange={e => setForm(p => ({ ...p, writing_task2_topic: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className="p-3 rounded-xl text-sm font-medium"
              style={{
                background: message.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color:      message.ok ? 'var(--success)'       : 'var(--error)',
                border:    `1px solid ${message.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              {message.ok ? '✅' : '❌'} {message.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? 'Saqlanmoqda…' : (editingId ? 'Saqlash' : 'Yaratish')}
            </button>
            {editingId && (
              <button
                onClick={() => { if (!confirm('Bu jadvalni o\'chirishni tasdiqlaysizmi?')) return; handleDelete(editingId) }}
                disabled={deleting === editingId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {deleting === editingId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                O&apos;chirish
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ SCHEDULE LIST ═════════════════════════════════════════════════ */}
      {schedules.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={36} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Hali mock test jadvallari yo&apos;q</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            &quot;Yangi jadval&quot; tugmasini bosib jadval yarating
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map(s => {
            const cfg = statusCfg(s.status)
            const isEditing = editingId === s.id && showForm
            return (
              <div key={s.id} className="card p-4"
                style={{ border: isEditing ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)' }}>
                {/* ── top row ── */}
                <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  {/* Date badge */}
                  <div className="shrink-0 w-14 rounded-xl text-center py-2"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(s.date + 'T00:00').toLocaleString('en', { month: 'short' })}
                    </div>
                    <div className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                      {new Date(s.date + 'T00:00').getDate()}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.date}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{s.time}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {s.reading_file_url && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <BookOpen size={10} /> Reading
                        </span>
                      )}
                      {s.listening_file_url && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <Headphones size={10} /> Listening
                        </span>
                      )}
                      {(s.writing_task1_topic || s.writing_task2_topic) && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <PenTool size={10} /> Writing
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Submissions modal button */}
                  <button
                    onClick={() => openModal(s)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}>
                    <FileText size={11} />
                    Javoblar
                  </button>

                  {/* Bookings modal button */}
                  <button
                    onClick={() => openBookingsModal(s)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}>
                    <Users size={11} />
                    Bookinglar
                  </button>

                  <button onClick={() => isEditing ? closeForm() : openEdit(s)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: isEditing ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
                      color:      isEditing ? 'var(--accent)'          : 'var(--text-muted)',
                      border: '1px solid var(--border)',
                    }}>
                    {isEditing ? <ChevronUp size={13} /> : <Edit2 size={13} />}
                    {isEditing ? 'Yopish' : 'Tahrirlash'}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => setDeleteConfirmId(deleteConfirmId === s.id ? null : s.id)}
                    disabled={deleting === s.id}
                    className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                    style={{
                      background: deleteConfirmId === s.id ? 'rgba(239,68,68,0.12)' : 'var(--bg-secondary)',
                      color:      deleteConfirmId === s.id ? 'var(--error)'          : 'var(--text-muted)',
                      border: `1px solid ${deleteConfirmId === s.id ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                    }}>
                    {deleting === s.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />}
                  </button>
                </div>
              </div>

              {/* ── Inline delete confirmation ── */}
              {deleteConfirmId === s.id && (
                <div className="flex items-center justify-between gap-3 pt-3 mt-3"
                  style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Bu seansni o&apos;chirishni tasdiqlaysizmi?
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      Yo&apos;q
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      {deleting === s.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Trash2 size={11} />}
                      Ha, o&apos;chirish
                    </button>
                  </div>
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* ══ BOOKINGS MODAL ══════════════════════════════════════════════ */}
      {bookingsModalId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeBookingsModal() }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  Bookinglar
                </h3>
                {bookingsModalSchedule && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {bookingsModalSchedule.date} · {bookingsModalSchedule.time}
                    {!bookingsLoading && ` · ${bookingsData.length} ta foydalanuvchi`}
                  </p>
                )}
              </div>
              <button onClick={closeBookingsModal} className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {bookingsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda…</p>
                </div>
              ) : bookingsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Users size={36} className="opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Hali booking qilganlar yo&apos;q</p>
                </div>
              ) : (
                bookingsData.map((b, idx) => {
                  const nameParts = b.user_name.trim().split(/\s+/)
                  const av = nameParts.length >= 2
                    ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                    : b.user_name.slice(0, 2).toUpperCase()
                  const bsCfg = ({
                    pending:   { label: 'Kutilmoqda',    bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)', border: 'rgba(245,158,11,0.3)' },
                    confirmed: { label: 'Tasdiqlangan',  bg: 'rgba(34,197,94,0.12)',  color: 'var(--success)', border: 'rgba(34,197,94,0.3)' },
                    cancelled: { label: 'Bekor qilindi', bg: 'rgba(239,68,68,0.12)',  color: 'var(--error)',   border: 'rgba(239,68,68,0.3)' },
                    resigned:  { label: 'Kelmadi',       bg: 'rgba(239,68,68,0.08)',  color: 'var(--error)',   border: 'rgba(239,68,68,0.2)' },
                  } as Record<string, { label: string; bg: string; color: string; border: string }>)[b.status]
                    ?? { label: b.status, bg: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'var(--border)' }

                  return (
                    <div key={b.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: b.is_premium ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
                          color: b.is_premium ? 'var(--warning)' : 'var(--accent)',
                        }}>
                        {av}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {idx + 1}. {b.user_name}
                          </span>
                          {b.is_premium ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                              style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }}>
                              <Crown size={10} /> Premium
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                              style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
                              <User size={10} /> Oddiy
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                            style={{ background: bsCfg.bg, color: bsCfg.color, border: `1px solid ${bsCfg.border}` }}>
                            {bsCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <Mail size={10} /> {b.user_email || '—'}
                          </span>
                          {b.user_phone ? (
                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <Phone size={10} /> {b.user_phone}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs italic" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                              <Phone size={10} /> Telefon kiritilmagan
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Booking timestamp */}
                      <div className="text-xs shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>
                        {new Date(b.created_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ SUBMISSIONS MODAL ═══════════════════════════════════════════ */}
      {modalScheduleId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  Mock Test Javoblari
                </h3>
                {modalSchedule && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {modalSchedule.date} · {modalSchedule.time}
                  </p>
                )}
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda…</p>
                </div>
              ) : modalSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <FileText size={36} className="opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Hali topshirilgan javoblar yo&apos;q</p>
                </div>
              ) : (
                modalSubmissions.map((sub, idx) => (
                  <SubmissionCard
                    key={sub.id}
                    sub={sub}
                    index={idx + 1}
                    task1ImageUrl={modalSchedule?.writing_task1_image_url}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
