'use client'

import {
  useState, useEffect, useRef, useCallback,
} from 'react'
import Link from 'next/link'
import {
  Headphones, BookOpen, PenTool, CheckCircle,
  ArrowRight, Loader2, Clock, AlertTriangle, Send,
  ChevronRight,
} from 'lucide-react'

/* ─────────────────────────────── Types ─────────────────────────────── */
export interface MockScheduleForFlow {
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

type Step = 'listening' | 'reading' | 'writing' | 'done'

const STEPS: Step[] = ['listening', 'reading', 'writing', 'done']
const WRITING_SECONDS = 60 * 60 // 60 minutes
const AUTOSAVE_MS = 30_000       // 30 seconds

/* ─────────────────────────── Helpers ───────────────────────────────── */
function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function fmtTimer(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

function buildInjectScript(): string {
  return `<script>(function(){
    var sel='button,input[type="submit"],input[type="button"]';
    document.querySelectorAll(sel).forEach(function(el){
      var txt=(el.textContent||el.value||'').toLowerCase();
      if(/check|submit|finish|done/.test(txt)){
        el.addEventListener('click',function(){
          window.parent.postMessage({type:'CDI_CHECK_ANSWERS'},'*');
        });
      }
    });
    window.addEventListener('message',function(e){
      if(e.data&&e.data.type==='CDI_REQUEST_DONE'){
        window.parent.postMessage({type:'CDI_CHECK_ANSWERS'},'*');
      }
    });
  })();<\/script>`
}

/* ─────────────────── Step progress bar ─────────────────────────────── */
function StepBar({ current }: { current: Step }) {
  const labels: Record<Exclude<Step, 'done'>, { Icon: React.ElementType; label: string }> = {
    listening: { Icon: Headphones,  label: 'Listening' },
    reading:   { Icon: BookOpen,    label: 'Reading'   },
    writing:   { Icon: PenTool,     label: 'Writing'   },
  }
  const order: Exclude<Step, 'done'>[] = ['listening', 'reading', 'writing']
  const currentIdx = order.indexOf(current as Exclude<Step, 'done'>)

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-xs mx-auto">
      {order.map((step, i) => {
        const { Icon, label } = labels[step]
        const done   = currentIdx > i
        const active = currentIdx === i
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-secondary)',
                  border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {done
                  ? <CheckCircle size={14} color="white" />
                  : <Icon size={13} color={active ? 'white' : 'var(--text-muted)'} />}
              </div>
              <span className="text-[10px] font-medium"
                style={{ color: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--text-muted)' }}>
                {label}
              </span>
            </div>
            {i < order.length - 1 && (
              <div className="w-8 h-0.5 mb-4 mx-0.5" style={{ background: done ? 'var(--success)' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────── CDI HTML Blob hook ─────────────────────────── */
function useHtmlBlobUrl(fileUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading]  = useState(false)

  useEffect(() => {
    if (!fileUrl) return
    const ext = fileUrl.split('?')[0].split('.').pop()?.toLowerCase()
    if (ext !== 'html' && ext !== 'htm') return
    setLoading(true)
    let revoke = ''
    fetch(fileUrl)
      .then(r => r.text())
      .then(html => {
        const injected = html.replace('</body>', buildInjectScript() + '</body>')
        const blob = new Blob([injected], { type: 'text/html' })
        revoke = URL.createObjectURL(blob)
        setBlobUrl(revoke)
      })
      .catch(() => setBlobUrl(fileUrl))
      .finally(() => setLoading(false))
    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [fileUrl])

  return { blobUrl, loading }
}

/* ──────────────────── Listening Section ────────────────────────────── */
function ListeningSection({
  fileUrl,
  answers,
  onChange,
  onNext,
}: {
  fileUrl: string | null
  answers: Record<string, string>
  onChange: (answers: Record<string, string>) => void
  onNext: () => void
}) {
  const ext = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)
  const isHtml  = ext === 'html' || ext === 'htm'
  const { blobUrl, loading } = useHtmlBlobUrl(isHtml ? fileUrl : null)
  const [cdiDone, setCdiDone] = useState(false)

  // Listen for CDI check-answers message
  useEffect(() => {
    if (!isHtml) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'CDI_CHECK_ANSWERS') setCdiDone(true)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isHtml])

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4"
        style={{ color: 'var(--text-muted)' }}>
        <AlertTriangle size={36} className="opacity-30" />
        <p className="text-sm">Listening fayli yuklanmagan</p>
        <button onClick={onNext} className="btn-primary mt-2">
          Reading ga o&apos;tish <ChevronRight size={15} />
        </button>
      </div>
    )
  }

  /* HTML (CDI) Listening */
  if (isHtml) {
    if (loading) return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
    return (
      <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 220px)', minHeight: 400 }}>
        <iframe
          src={blobUrl ?? fileUrl}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
          title="Listening test"
        />
        {cdiDone && (
          <button
            onClick={onNext}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent)', zIndex: 10 }}>
            Reading ga o&apos;tish <ArrowRight size={15} />
          </button>
        )}
      </div>
    )
  }

  /* Audio Listening — audio player + 40 answer inputs */
  const setAnswer = (q: string, val: string) =>
    onChange({ ...answers, [q]: val })

  return (
    <div className="space-y-6 pb-8">
      {/* Audio player */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Headphones size={20} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Listening Audio</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Audioli eshiting va javoblarni to&apos;ldiring
            </p>
          </div>
        </div>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          controls
          controlsList="nodownload"
          className="w-full"
          style={{ borderRadius: 8 }}
        >
          <source src={fileUrl} />
        </audio>
      </div>

      {/* Answer inputs: 40 questions */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
          Javoblar (1–40)
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 40 }, (_, i) => {
            const q = String(i + 1)
            return (
              <div key={q} className="flex items-center gap-2">
                <span className="text-xs w-5 shrink-0 font-mono text-right"
                  style={{ color: 'var(--text-muted)' }}>
                  {q}.
                </span>
                <input
                  type="text"
                  className="input-field text-sm py-1.5 px-2 flex-1 min-w-0"
                  placeholder="..."
                  value={answers[q] ?? ''}
                  onChange={e => setAnswer(q, e.target.value)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white hover:opacity-90 active:scale-95"
        style={{ background: 'linear-gradient(135deg, var(--success), #059669)' }}>
        Reading ga o&apos;tish <ArrowRight size={16} />
      </button>
    </div>
  )
}

/* ──────────────────────── Reading Section ──────────────────────────── */
function ReadingSection({
  fileUrl,
  onNext,
}: {
  fileUrl: string | null
  onNext: () => void
}) {
  const ext = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const isHtml = ext === 'html' || ext === 'htm'
  const { blobUrl, loading } = useHtmlBlobUrl(isHtml ? fileUrl : null)
  const [cdiDone, setCdiDone] = useState(false)

  useEffect(() => {
    if (!isHtml) return
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'CDI_CHECK_ANSWERS') setCdiDone(true)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isHtml])

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4"
        style={{ color: 'var(--text-muted)' }}>
        <AlertTriangle size={36} className="opacity-30" />
        <p className="text-sm">Reading fayli yuklanmagan</p>
        <button onClick={onNext} className="btn-primary mt-2">
          Writing ga o&apos;tish <ChevronRight size={15} />
        </button>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 220px)', minHeight: 400 }}>
      <iframe
        src={(isHtml ? blobUrl : null) ?? fileUrl}
        style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12 }}
        title="Reading test"
      />
      {/* For HTML: wait for CDI done event. For PDF/other: always show */}
      {(!isHtml || cdiDone) && (
        <button
          onClick={onNext}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95"
          style={{ background: 'var(--accent)', zIndex: 10 }}>
          Writing ga o&apos;tish <ArrowRight size={15} />
        </button>
      )}
    </div>
  )
}

/* ──────────────────────── Writing Section ──────────────────────────── */
function WritingSection({
  schedule,
  task1,
  task2,
  onChangeTask1,
  onChangeTask2,
  onSubmit,
  submitting,
}: {
  schedule: MockScheduleForFlow
  task1: string
  task2: string
  onChangeTask1: (v: string) => void
  onChangeTask2: (v: string) => void
  onSubmit: () => void
  submitting: boolean
}) {
  const [secsLeft, setSecsLeft]   = useState(WRITING_SECONDS)
  const [expired, setExpired]     = useState(false)
  const startedAt = useRef<number>(Date.now())

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000)
      const rem     = Math.max(0, WRITING_SECONDS - elapsed)
      setSecsLeft(rem)
      if (rem === 0) { setExpired(true); clearInterval(iv) }
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Auto-submit on expiry
  useEffect(() => {
    if (expired && !submitting) onSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired])

  const timerWarn   = secsLeft < 10 * 60
  const timerDanger = secsLeft < 5 * 60

  return (
    <div className="space-y-6 pb-8">
      {/* Timer */}
      <div className="flex items-center justify-between p-4 rounded-2xl"
        style={{
          background: timerDanger ? 'rgba(239,68,68,0.08)' : timerWarn ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
          border: `1px solid ${timerDanger ? 'rgba(239,68,68,0.3)' : timerWarn ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
        }}>
        <div className="flex items-center gap-2">
          <Clock size={15} style={{ color: timerDanger ? 'var(--error)' : timerWarn ? 'var(--warning)' : 'var(--text-muted)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Qolgan vaqt
          </span>
        </div>
        <div className={`font-mono font-bold text-lg ${timerDanger ? 'animate-pulse' : ''}`}
          style={{ color: timerDanger ? 'var(--error)' : timerWarn ? 'var(--warning)' : 'var(--text-primary)' }}>
          {fmtTimer(secsLeft)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${(secsLeft / WRITING_SECONDS) * 100}%`,
            background: timerDanger ? 'var(--error)' : timerWarn ? 'var(--warning)' : 'var(--accent)',
          }} />
      </div>

      {/* Task 1 */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'var(--accent)' }}>1</div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Writing Task 1</h3>
        </div>

        {schedule.writing_task1_image_url && (
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={schedule.writing_task1_image_url}
              alt="Task 1 chart/graph"
              className="w-full max-h-72 object-contain"
              style={{ background: 'var(--bg-secondary)' }}
            />
          </div>
        )}

        {schedule.writing_task1_topic && (
          <div className="p-4 rounded-xl text-sm leading-relaxed"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', color: 'var(--text-secondary)' }}>
            {schedule.writing_task1_topic}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Sizning javobingiz
            </label>
            <span className="text-xs"
              style={{ color: wordCount(task1) >= 150 ? 'var(--success)' : 'var(--warning)' }}>
              {wordCount(task1)} so&apos;z (min. 150)
            </span>
          </div>
          <textarea
            className="input-field text-sm resize-none leading-relaxed"
            rows={10}
            placeholder="Task 1 javobingizni shu yerga yozing..."
            value={task1}
            onChange={e => onChangeTask1(e.target.value)}
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
            <span className="text-xs"
              style={{ color: wordCount(task2) >= 250 ? 'var(--success)' : 'var(--warning)' }}>
              {wordCount(task2)} so&apos;z (min. 250)
            </span>
          </div>
          <textarea
            className="input-field text-sm resize-none leading-relaxed"
            rows={14}
            placeholder="Task 2 javobingizni shu yerga yozing..."
            value={task2}
            onChange={e => onChangeTask2(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
        {submitting
          ? <><Loader2 size={18} className="animate-spin" /> Topshirilmoqda…</>
          : <><Send size={18} /> Mock Test ni topshirish</>}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MockTestFlow — main export
   ═══════════════════════════════════════════════════════════════════════ */
export function MockTestFlow({ schedule }: { schedule: MockScheduleForFlow }) {
  const storageKey = `mock_draft_${schedule.id}`

  /* ── State ── */
  const [step, setStep]             = useState<Step>('listening')
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({})
  const [task1, setTask1]           = useState('')
  const [task2, setTask2]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastSaved, setLastSaved]   = useState<Date | null>(null)

  /* ── Load draft from localStorage on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.step)              setStep(draft.step)
      if (draft.listeningAnswers)  setListeningAnswers(draft.listeningAnswers)
      if (draft.task1)             setTask1(draft.task1)
      if (draft.task2)             setTask2(draft.task2)
    } catch {
      // ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Save draft to localStorage + API every 30 s ── */
  const saveDraft = useCallback(async (
    currentStep: Step,
    currentListening: Record<string, string>,
    currentTask1: string,
    currentTask2: string,
  ) => {
    if (currentStep === 'done') return

    // localStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        step: currentStep,
        listeningAnswers: currentListening,
        task1: currentTask1,
        task2: currentTask2,
        savedAt: new Date().toISOString(),
      }))
    } catch { /* quota */ }

    // API draft (fire-and-forget)
    fetch('/api/mock/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule_id: schedule.id,
        listening_answers: currentListening,
        writing_task1: currentTask1,
        writing_task2: currentTask2,
        status: 'draft',
      }),
    })
      .then(() => setLastSaved(new Date()))
      .catch(() => { /* silent */ })
  }, [storageKey, schedule.id])

  // Refs so the interval closure always sees fresh state
  const stateRef = useRef({ step, listeningAnswers, task1, task2 })
  useEffect(() => {
    stateRef.current = { step, listeningAnswers, task1, task2 }
  }, [step, listeningAnswers, task1, task2])

  useEffect(() => {
    const iv = setInterval(() => {
      const { step: s, listeningAnswers: la, task1: t1, task2: t2 } = stateRef.current
      saveDraft(s, la, t1, t2)
    }, AUTOSAVE_MS)
    return () => clearInterval(iv)
  }, [saveDraft])

  /* ── Final submit ── */
  const handleFinalSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/mock/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: schedule.id,
          listening_answers: listeningAnswers,
          writing_task1: task1,
          writing_task2: task2,
          status: 'submitted',
        }),
      })
      if (res.ok) {
        // Clear localStorage draft
        try { localStorage.removeItem(storageKey) } catch { /* ok */ }
        setStep('done')
      }
    } catch (err) {
      console.error('[MockTestFlow] submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, schedule.id, listeningAnswers, task1, task2, storageKey])

  /* ── Done screen ── */
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)' }}>
          <CheckCircle size={48} style={{ color: 'var(--success)' }} />
        </div>
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
            Mock Test yakunlandi! 🎉
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Sizning javoblaringiz muvaffaqiyatli topshirildi.
            Natijalar tez orada adminlar tomonidan tekshiriladi.
          </p>
        </div>
        <Link
          href="/mock-test"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white"
          style={{ background: 'var(--accent)' }}>
          Mock Test sahifasiga qaytish
        </Link>
      </div>
    )
  }

  /* ── Main layout ── */
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 px-4 py-3"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Mock IELTS — {schedule.date} {schedule.time.slice(0, 5)}
          </div>

          <StepBar current={step} />

          {lastSaved && (
            <div className="text-xs shrink-0 hidden sm:block" style={{ color: 'var(--text-muted)' }}>
              Saqlandi {lastSaved.toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Section content */}
      <div className="p-4 max-w-5xl mx-auto">
        {step === 'listening' && (
          <ListeningSection
            fileUrl={schedule.listening_file_url}
            answers={listeningAnswers}
            onChange={setListeningAnswers}
            onNext={() => setStep('reading')}
          />
        )}

        {step === 'reading' && (
          <ReadingSection
            fileUrl={schedule.reading_file_url}
            onNext={() => setStep('writing')}
          />
        )}

        {step === 'writing' && (
          <WritingSection
            schedule={schedule}
            task1={task1}
            task2={task2}
            onChangeTask1={setTask1}
            onChangeTask2={setTask2}
            onSubmit={handleFinalSubmit}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}
