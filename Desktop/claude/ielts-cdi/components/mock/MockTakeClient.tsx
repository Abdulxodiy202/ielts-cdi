'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  BookOpen, Headphones, PenTool, ArrowLeft, CheckCircle,
  Loader2, Clock, AlertTriangle, Image as ImageIcon, Send, X,
} from 'lucide-react'

/* ─────────────────────────────── Types ─────────────────────────────── */
export interface MockSchedule {
  id: string
  date: string
  time: string
  status: string
  reading_file_url: string | null
  listening_file_url: string | null
  writing_task1_image_url: string | null
  writing_task1_topic: string | null
  writing_task2_topic: string | null
}

type Tab = 'reading' | 'listening' | 'writing'

/* ─────────────────────────── CDI HTML helpers ──────────────────────── */
function buildInjectScript(): string {
  return `
<script>
(function() {
  var sel = 'button, input[type="submit"], input[type="button"]';
  document.querySelectorAll(sel).forEach(function(el) {
    var txt = (el.textContent || el.value || '').toLowerCase();
    if (/check|submit|finish|done/.test(txt)) {
      el.addEventListener('click', function() {
        window.parent.postMessage({ type: 'CDI_CHECK_ANSWERS' }, '*');
      });
    }
  });
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'CDI_REQUEST_DONE') {
      window.parent.postMessage({ type: 'CDI_CHECK_ANSWERS' }, '*');
    }
  });
})();
<` + '/script>'
}

function useHtmlBlobUrl(fileUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!fileUrl) return
    let revoke: string | null = null
    const ext = fileUrl.split('?')[0].split('.').pop()?.toLowerCase()
    if (ext !== 'html' && ext !== 'htm') return
    fetch(fileUrl)
      .then(r => r.text())
      .then(html => {
        const injected = html.replace('</body>', buildInjectScript() + '</body>')
        const blob = new Blob([injected], { type: 'text/html' })
        revoke = URL.createObjectURL(blob)
        setBlobUrl(revoke)
      })
      .catch(() => setBlobUrl(fileUrl)) // fallback to direct URL
    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [fileUrl])
  return blobUrl
}

/* ─────────────────────── Writing timer hook ────────────────────────── */
const WRITING_SECONDS = 60 * 60 // 60 minutes

function useWritingTimer(active: boolean) {
  const [secsLeft, setSecsLeft] = useState(WRITING_SECONDS)
  const [expired, setExpired] = useState(false)
  const startedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    if (startedAt.current === null) startedAt.current = Date.now()
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current!) / 1000)
      const remaining = Math.max(0, WRITING_SECONDS - elapsed)
      setSecsLeft(remaining)
      if (remaining === 0) { setExpired(true); clearInterval(iv) }
    }, 1000)
    return () => clearInterval(iv)
  }, [active])

  const timeTaken = startedAt.current
    ? Math.floor((Date.now() - startedAt.current) / 1000)
    : 0

  return { secsLeft, expired, timeTaken }
}

function fmtTimer(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts = [String(h).padStart(2, '0'), String(m).padStart(2, '0'), String(sec).padStart(2, '0')]
  return parts.join(':')
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/* ─────────────────────── CDI Section component ─────────────────────── */
function CdiSection({
  fileUrl,
  onDone,
  onCDISubmit,
}: {
  fileUrl: string | null
  onDone?: () => void
  onCDISubmit?: (answers: Record<string, string>) => void
}) {
  const ext = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase()
  const isHtml = ext === 'html' || ext === 'htm'
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext ?? '')
  const htmlBlobUrl = useHtmlBlobUrl(isHtml ? fileUrl : null)
  const [showDone, setShowDone] = useState(false)

  // Listen for CDI_CHECK_ANSWERS and CDI_SUBMIT from iframe
  useEffect(() => {
    if (!isHtml) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'CDI_CHECK_ANSWERS') {
        setShowDone(true)
      }
      if (e.data?.type === 'CDI_SUBMIT' && onCDISubmit) {
        // Convert resultsData array → Record<string, string>
        // e.g. [{ question: 'q1', userAnswer: 'advertising' }, ...]
        //   or [{ question: 1,    userAnswer: 'NOT GIVEN' }, ...]
        const record: Record<string, string> = {}
        for (const item of (e.data.answers ?? [])) {
          const key = String(item.question ?? '')
          const val = String(item.userAnswer ?? '').trim()
          // 'No Answer' / 'Not Answered' → treat as empty
          record[key] = (val === 'No Answer' || val === 'Not Answered') ? '' : val
        }
        onCDISubmit(record)
        setShowDone(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isHtml, onCDISubmit])

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3"
        style={{ color: 'var(--text-muted)' }}>
        <AlertTriangle size={36} className="opacity-30" />
        <p className="text-sm">Bu bo&apos;lim uchun fayl yuklanmagan</p>
      </div>
    )
  }

  if (isHtml) {
    if (!htmlBlobUrl) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      )
    }
    return (
      <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 180px)', minHeight: 400 }}>
        <iframe
          src={htmlBlobUrl}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
          title="Test"
        />
        {showDone && onDone && (
          <button
            onClick={onDone}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-xl transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent)', zIndex: 10 }}>
            Keyingi bo&apos;lim <ArrowLeft size={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)' }}>
          <Headphones size={36} style={{ color: 'var(--success)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Listening faylini ijro eting va savollarni javoblang
        </p>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls className="w-full max-w-md" style={{ borderRadius: 12 }}>
          <source src={fileUrl} />
        </audio>
        {onDone && (
          <button onClick={onDone}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white"
            style={{ background: 'var(--accent)' }}>
            Keyingi bo&apos;lim <ArrowLeft size={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>
    )
  }

  // PDF or other
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 180px)', minHeight: 400 }}>
      <iframe
        src={fileUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }}
        title="Test file"
      />
    </div>
  )
}

/* ─────────────────────── Writing section ───────────────────────────── */
function WritingSection({
  schedule,
  onSubmit,
}: {
  schedule: MockSchedule
  onSubmit: (t1: string, t2: string, timeTaken: number) => Promise<void>
}) {
  const [task1, setTask1] = useState('')
  const [task2, setTask2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Timer starts when this component mounts (tab first opened)
  const { secsLeft, expired, timeTaken } = useWritingTimer(true)

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return
    setSubmitting(true)
    await onSubmit(task1, task2, timeTaken)
    setSubmitted(true)
    setSubmitting(false)
  }, [submitting, submitted, task1, task2, timeTaken, onSubmit])

  // Auto-submit on timer expiry
  useEffect(() => {
    if (expired && !submitted) handleSubmit()
  }, [expired, submitted, handleSubmit])

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)' }}>
          <CheckCircle size={40} style={{ color: 'var(--success)' }} />
        </div>
        <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Writing topshirildi! ✅
        </h3>
        <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
          Sizning javoblaringiz saqlandi. Mock test muvaffaqiyatli yakunlandi!
        </p>
        <Link href="/mock-test" className="btn-primary mt-2">
          <ArrowLeft size={15} /> Mock Test sahifasiga qaytish
        </Link>
      </div>
    )
  }

  const timerWarning = secsLeft < 10 * 60 // last 10 min
  const timerDanger  = secsLeft < 5 * 60  // last 5 min

  return (
    <div className="space-y-6 pb-8">
      {/* Timer bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl"
        style={{
          background: timerDanger
            ? 'rgba(239,68,68,0.1)'
            : timerWarning
              ? 'rgba(245,158,11,0.1)'
              : 'var(--bg-secondary)',
          border: `1px solid ${timerDanger ? 'rgba(239,68,68,0.3)' : timerWarning ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
        }}>
        <div className="flex items-center gap-2">
          <Clock size={16} style={{ color: timerDanger ? 'var(--error)' : timerWarning ? 'var(--warning)' : 'var(--text-muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Qolgan vaqt
          </span>
        </div>
        <div className={`font-mono font-bold text-lg ${timerDanger ? 'animate-pulse' : ''}`}
          style={{ color: timerDanger ? 'var(--error)' : timerWarning ? 'var(--warning)' : 'var(--text-primary)' }}>
          {fmtTimer(secsLeft)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${(secsLeft / WRITING_SECONDS) * 100}%`,
            background: timerDanger ? 'var(--error)' : timerWarning ? 'var(--warning)' : 'var(--accent)',
          }} />
      </div>

      {/* Task 1 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--accent)' }}>1</div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Writing Task 1</h3>
        </div>

        {/* Task 1 image — click to open fullscreen */}
        {schedule.writing_task1_image_url && (
          <div className="group relative rounded-xl overflow-hidden" style={{ cursor: 'zoom-in' }}
            onClick={() => setLightboxUrl(schedule.writing_task1_image_url)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={schedule.writing_task1_image_url}
              alt="Task 1 chart/graph"
              className="w-full max-h-72 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              style={{ background: 'var(--bg-secondary)' }}
            />
            <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-xs px-2 py-1 rounded-lg font-medium"
                style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                Kattalashtirish uchun bosing
              </span>
            </div>
          </div>
        )}
        {!schedule.writing_task1_image_url && (
          <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
            <ImageIcon size={14} /> Rasm yuklanmagan
          </div>
        )}

        {/* Task 1 prompt */}
        {schedule.writing_task1_topic && (
          <div className="p-4 rounded-xl text-sm leading-relaxed"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', color: 'var(--text-secondary)' }}>
            {schedule.writing_task1_topic}
          </div>
        )}

        {/* Answer textarea */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Sizning javobingiz
            </label>
            <span className="text-xs" style={{ color: wordCount(task1) >= 150 ? 'var(--success)' : 'var(--warning)' }}>
              {wordCount(task1)} so&apos;z (min. 150)
            </span>
          </div>
          <textarea
            className="input-field text-sm resize-none leading-relaxed"
            rows={10}
            placeholder="Task 1 javobingizni shu yerga yozing..."
            value={task1}
            onChange={e => setTask1(e.target.value)}
          />
        </div>
      </div>

      {/* Task 2 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: '#7c3aed' }}>2</div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Writing Task 2</h3>
        </div>

        {schedule.writing_task2_topic && (
          <div className="p-4 rounded-xl text-sm leading-relaxed"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', color: 'var(--text-secondary)' }}>
            {schedule.writing_task2_topic}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Sizning javobingiz
            </label>
            <span className="text-xs" style={{ color: wordCount(task2) >= 250 ? 'var(--success)' : 'var(--warning)' }}>
              {wordCount(task2)} so&apos;z (min. 250)
            </span>
          </div>
          <textarea
            className="input-field text-sm resize-none leading-relaxed"
            rows={14}
            placeholder="Task 2 javobingizni shu yerga yozing..."
            value={task2}
            onChange={e => setTask2(e.target.value)}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white transition-all hover:opacity-90 active:scale-95"
        style={{ background: submitting ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
        {submitting
          ? <><Loader2 size={18} className="animate-spin" /> Topshirilmoqda…</>
          : <><Send size={18} /> Topshirish</>}
      </button>

      {/* Fullscreen lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
            onClick={e => { e.stopPropagation(); setLightboxUrl(null) }}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Task rasm (katta)"
            style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 12 }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MockTakeClient — main export
   ══════════════════════════════════════════════════════════════════════ */
export function MockTakeClient({ schedule }: { schedule: MockSchedule }) {
  const [activeTab, setActiveTab] = useState<Tab>('reading')
  const [writingStarted, setWritingStarted] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  // Track listening/reading answers captured from CDI_SUBMIT postMessages
  const listeningAnswersRef = useRef<Record<string, string>>({})
  const readingAnswersRef   = useRef<Record<string, string>>({})

  // Save listening/reading answers to the DB (upsert draft)
  const saveHtmlAnswers = useCallback(async (
    testType: 'listening' | 'reading',
    answers: Record<string, string>,
  ) => {
    if (testType === 'listening') listeningAnswersRef.current = answers
    if (testType === 'reading')   readingAnswersRef.current   = answers
    try {
      await fetch('/api/mock/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: schedule.id,
          listening_answers: listeningAnswersRef.current,
          reading_answers:   readingAnswersRef.current,
          status: 'draft',
        }),
      })
    } catch {
      // Non-critical — best-effort save
    }
  }, [schedule.id])

  const tabs = [
    { id: 'reading'   as Tab, label: 'Reading',   Icon: BookOpen,    available: !!schedule.reading_file_url },
    { id: 'listening' as Tab, label: 'Listening', Icon: Headphones,  available: !!schedule.listening_file_url },
    { id: 'writing'   as Tab, label: 'Writing',   Icon: PenTool,     available: !!(schedule.writing_task1_topic || schedule.writing_task2_topic) },
  ]

  const handleWritingSubmit = async (t1: string, t2: string, timeTaken: number) => {
    await fetch('/api/mock/writing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule_id: schedule.id,
        task1_answer: t1,
        task2_answer: t2,
        time_taken: timeTaken,
      }),
    })
    setSubmitDone(true)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/mock-test"
          className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} /> Chiqish
        </Link>

        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          Mock IELTS Test — {schedule.date} {schedule.time.slice(0, 5)}
        </div>

        <div className="w-16" />
      </div>

      {/* Tab bar */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex gap-1 p-1 rounded-xl w-full max-w-sm mx-auto"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          {tabs.map(({ id, label, Icon, available }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id)
                  if (id === 'writing') setWritingStarted(true)
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'white' : available ? 'var(--text-secondary)' : 'var(--text-muted)',
                  opacity: !available && !active ? 0.5 : 1,
                }}>
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 max-w-5xl mx-auto">
        {activeTab === 'reading' && (
          <CdiSection
            fileUrl={schedule.reading_file_url}
            onDone={() => setActiveTab('listening')}
            onCDISubmit={answers => saveHtmlAnswers('reading', answers)}
          />
        )}
        {activeTab === 'listening' && (
          <CdiSection
            fileUrl={schedule.listening_file_url}
            onDone={() => { setActiveTab('writing'); setWritingStarted(true) }}
            onCDISubmit={answers => saveHtmlAnswers('listening', answers)}
          />
        )}
        {activeTab === 'writing' && (writingStarted || submitDone) && (
          <WritingSection
            schedule={schedule}
            onSubmit={handleWritingSubmit}
          />
        )}
        {activeTab === 'writing' && !writingStarted && !submitDone && (
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.3)' }}>
              <PenTool size={36} style={{ color: 'var(--warning)' }} />
            </div>
            <div className="text-center max-w-xs">
              <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                Writing bo&apos;limi
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Bosganingizda 60 daqiqalik taymer boshlanadi. Tayyor bo&apos;lganda bosing.
              </p>
            </div>
            <button
              onClick={() => setWritingStarted(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--warning), #d97706)' }}>
              <Clock size={16} /> Taymerni boshlash (60 daqiqa)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
