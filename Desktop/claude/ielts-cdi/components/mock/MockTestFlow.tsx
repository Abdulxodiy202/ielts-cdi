'use client'

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import Link from 'next/link'
import {
  Headphones, BookOpen, PenTool, CheckCircle,
  ArrowRight, Loader2, Clock, AlertTriangle, Send,
  ChevronRight, Play, Pause, Info, Volume2,
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

type Step = 'pre-start' | 'listening' | 'reading' | 'writing' | 'done'

/* ── Section durations (minutes) ── */
const LISTEN_MINS   = 40
const READ_MINS     = 60
const WRITE_MINS    = 60
const LISTEN_END_MS = LISTEN_MINS * 60 * 1000
const READ_END_MS   = (LISTEN_MINS + READ_MINS) * 60 * 1000
const WRITE_END_MS  = (LISTEN_MINS + READ_MINS + WRITE_MINS) * 60 * 1000
const AUTOSAVE_MS   = 30_000

/* ─────────────────────────── Helpers ─────────────────────────────── */
function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function fmtTimer(totalSecs: number) {
  const s   = Math.max(0, totalSecs)
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
  return [m, sec].map(n => String(n).padStart(2, '0')).join(':')
}

function fmtMmSs(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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

function stepFromElapsed(elapsedMs: number): Step {
  if (elapsedMs < 0)              return 'pre-start'
  if (elapsedMs < LISTEN_END_MS)  return 'listening'
  if (elapsedMs < READ_END_MS)    return 'reading'
  if (elapsedMs < WRITE_END_MS)   return 'writing'
  return 'done'
}

/* ─────────────────── Step progress bar ─────────────────────────────── */
type ActiveStep = Exclude<Step, 'pre-start' | 'done'>

function StepBar({ current }: { current: Step }) {
  const labels: Record<ActiveStep, { Icon: React.ElementType; label: string }> = {
    listening: { Icon: Headphones, label: 'Listening' },
    reading:   { Icon: BookOpen,   label: 'Reading'   },
    writing:   { Icon: PenTool,    label: 'Writing'   },
  }
  const order: ActiveStep[] = ['listening', 'reading', 'writing']
  const currentIdx = order.indexOf(current as ActiveStep)

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-xs mx-auto">
      {order.map((step, i) => {
        const { Icon, label } = labels[step]
        const done   = currentIdx > i
        const active = currentIdx === i
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-secondary)',
                  border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
                }}>
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
              <div className="w-8 h-0.5 mb-4 mx-0.5"
                style={{ background: done ? 'var(--success)' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────── Section timer bar ─────────────────────────────────── */
function SectionTimer({
  secsLeft,
  totalSecs,
  label,
}: {
  secsLeft: number
  totalSecs: number
  label: string
}) {
  const warn   = secsLeft < 10 * 60
  const danger = secsLeft < 5 * 60
  const pct    = totalSecs > 0 ? (secsLeft / totalSecs) * 100 : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Clock size={13} style={{ color: danger ? 'var(--error)' : warn ? 'var(--warning)' : 'var(--text-muted)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <div className={`font-mono font-bold text-sm tabular-nums ${danger ? 'animate-pulse' : ''}`}
          style={{ color: danger ? 'var(--error)' : warn ? 'var(--warning)' : 'var(--text-primary)' }}>
          {fmtTimer(secsLeft)}
        </div>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${pct}%`,
            background: danger ? 'var(--error)' : warn ? 'var(--warning)' : 'var(--accent)',
          }} />
      </div>
    </div>
  )
}

/* ─────────────── CDI HTML Blob hook ─────────────────────────────────── */
function useHtmlBlobUrl(fileUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

/* ──────────── Custom Audio Player ──────────────────────────────────────
   Rules:
   - Autoplay on mount (user clicked "Start" so gesture is active)
   - No seek bar interaction (cursor: not-allowed)
   - No rewind / replay once ended
   - Only control: Pause / Resume button
   ───────────────────────────────────────────────────────────────────── */
function AudioPlayer({ src }: { src: string }) {
  const audioRef              = useRef<HTMLAudioElement>(null)
  const [playing,  setPlaying]  = useState(false)
  const [ended,    setEnded]    = useState(false)
  const [current,  setCurrent]  = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay  = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime  = () => setCurrent(audio.currentTime)
    const onMeta  = () => setDuration(isFinite(audio.duration) ? audio.duration : 0)
    const onEnded = () => { setPlaying(false); setEnded(true) }

    audio.addEventListener('play',           onPlay)
    audio.addEventListener('pause',          onPause)
    audio.addEventListener('timeupdate',     onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended',          onEnded)

    // Autoplay — allowed because the user just clicked "Testni boshlash"
    audio.play().catch(() => {
      // Browser blocked autoplay (rare after user gesture) — button will appear
    })

    return () => {
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('timeupdate',     onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended',          onEnded)
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || ended) return          // no replay once ended
    if (playing) audio.pause()
    else audio.play().catch(() => {})
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="card p-4 space-y-3">
      {/* Hidden native element — no browser controls */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="auto" style={{ display: 'none' }} />

      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Volume2 size={20} style={{ color: 'var(--success)' }} />
        </div>

        {/* Progress column */}
        <div className="flex-1 space-y-2 min-w-0">
          {/* Time display */}
          <div className="flex items-center justify-between text-xs font-mono"
            style={{ color: 'var(--text-muted)' }}>
            <span>{fmtMmSs(current)}</span>
            <span>{duration > 0 ? fmtMmSs(duration) : '--:--'}</span>
          </div>
          {/* Non-seekable progress bar */}
          <div
            title="Orqaga qaytib bo'lmaydi"
            style={{
              height: 6,
              background: 'var(--bg-secondary)',
              borderRadius: 9999,
              cursor: 'not-allowed',
              overflow: 'hidden',
            }}
          >
            <div style={{
              width: `${pct}%`,
              height: '100%',
              background: ended ? 'var(--text-muted)' : 'var(--success)',
              borderRadius: 9999,
              transition: 'width 0.8s linear',
            }} />
          </div>
        </div>

        {/* Pause / Resume — the ONLY control */}
        {!ended ? (
          <button
            type="button"
            aria-label={playing ? 'Pauza' : 'Davom ettirish'}
            onClick={toggle}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all hover:opacity-80 active:scale-95"
            style={{ background: 'var(--success)', color: 'white' }}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
        ) : (
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' }}>
            <CheckCircle size={17} />
          </div>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        {ended
          ? 'Audio yakunlandi — javoblarni to\'ldirishni davom eting'
          : 'Faqat pauza tugmasi mavjud · Orqaga qaytib yoki qayta boshlab bo\'lmaydi'}
      </p>
    </div>
  )
}

/* ──────────────────── Listening Section ────────────────────────────── */
function ListeningSection({
  fileUrl,
  answers,
  onChange,
  onNext,
  secsLeft,
}: {
  fileUrl: string | null
  answers: Record<string, string>
  onChange: (a: Record<string, string>) => void
  onNext: () => void
  secsLeft: number
}) {
  const ext      = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const isAudio  = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)
  const isHtml   = ext === 'html' || ext === 'htm'
  const { blobUrl, loading } = useHtmlBlobUrl(isHtml ? fileUrl : null)
  const [cdiDone, setCdiDone] = useState(false)

  useEffect(() => {
    if (!isHtml) return
    const h = (e: MessageEvent) => { if (e.data?.type === 'CDI_CHECK_ANSWERS') setCdiDone(true) }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [isHtml])

  /* ── No file ── */
  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4"
        style={{ color: 'var(--text-muted)' }}>
        <AlertTriangle size={36} className="opacity-30" />
        <p className="text-sm">Listening fayli yuklanmagan</p>
        <button type="button" onClick={onNext} className="btn-primary mt-2">
          Reading ga o&apos;tish <ChevronRight size={15} />
        </button>
      </div>
    )
  }

  /* ── CDI HTML — iframe fills remaining space ── */
  if (isHtml) {
    if (loading) return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 16px', flexShrink: 0 }}>
          <SectionTimer secsLeft={secsLeft} totalSecs={LISTEN_MINS * 60} label="Listening vaqti" />
        </div>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <iframe
            src={blobUrl ?? fileUrl}
            title="Listening test"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
          {cdiDone && (
            <button
              type="button"
              onClick={onNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95"
              style={{ position: 'absolute', bottom: 16, right: 16, background: 'var(--accent)', zIndex: 10 }}>
              Reading ga o&apos;tish <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ── Audio — custom player + 40-answer grid ── */
  const setAnswer = (q: string, val: string) => onChange({ ...answers, [q]: val })

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 896, margin: '0 auto', padding: '16px 16px 40px' }} className="space-y-5">
        <SectionTimer secsLeft={secsLeft} totalSecs={LISTEN_MINS * 60} label="Listening vaqti" />

        {/* Custom audio player — autoplay, pause-only, no seek */}
        <AudioPlayer src={fileUrl} />

        {/* Answer inputs */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Javoblar (1–40)</h3>
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
          type="button"
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg, var(--success), #059669)' }}>
          Reading ga o&apos;tish <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

/* ──────────────────────── Reading Section ──────────────────────────── */
function ReadingSection({
  fileUrl,
  onNext,
  secsLeft,
}: {
  fileUrl: string | null
  onNext: () => void
  secsLeft: number
}) {
  const ext    = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const isHtml = ext === 'html' || ext === 'htm'
  const { blobUrl, loading } = useHtmlBlobUrl(isHtml ? fileUrl : null)
  const [cdiDone, setCdiDone] = useState(false)

  useEffect(() => {
    if (!isHtml) return
    const h = (e: MessageEvent) => { if (e.data?.type === 'CDI_CHECK_ANSWERS') setCdiDone(true) }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [isHtml])

  /* ── No file ── */
  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4"
        style={{ color: 'var(--text-muted)' }}>
        <AlertTriangle size={36} className="opacity-30" />
        <p className="text-sm">Reading fayli yuklanmagan</p>
        <button type="button" onClick={onNext} className="btn-primary mt-2">
          Writing ga o&apos;tish <ChevronRight size={15} />
        </button>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  /* ── HTML (CDI) or PDF ── */
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 16px', flexShrink: 0 }}>
        <SectionTimer secsLeft={secsLeft} totalSecs={READ_MINS * 60} label="Reading vaqti" />
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <iframe
          src={(isHtml ? blobUrl : null) ?? fileUrl}
          title="Reading test"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
        {(!isHtml || cdiDone) && (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95"
            style={{ position: 'absolute', bottom: 16, right: 16, background: 'var(--accent)', zIndex: 10 }}>
            Writing ga o&apos;tish <ArrowRight size={15} />
          </button>
        )}
      </div>
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
  secsLeft,
}: {
  schedule: MockScheduleForFlow
  task1: string
  task2: string
  onChangeTask1: (v: string) => void
  onChangeTask2: (v: string) => void
  onSubmit: () => void
  submitting: boolean
  secsLeft: number
}) {
  const timerWarn   = secsLeft < 10 * 60
  const timerDanger = secsLeft < 5 * 60

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 896, margin: '0 auto', padding: '16px 16px 40px' }} className="space-y-6">
        {/* Timer */}
        <div className="flex items-center justify-between p-4 rounded-2xl"
          style={{
            background: timerDanger ? 'rgba(239,68,68,0.08)' : timerWarn ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
            border: `1px solid ${timerDanger ? 'rgba(239,68,68,0.3)' : timerWarn ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
          }}>
          <div className="flex items-center gap-2">
            <Clock size={15} style={{ color: timerDanger ? 'var(--error)' : timerWarn ? 'var(--warning)' : 'var(--text-muted)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Writing vaqti qoldi</span>
          </div>
          <div className={`font-mono font-bold text-lg tabular-nums ${timerDanger ? 'animate-pulse' : ''}`}
            style={{ color: timerDanger ? 'var(--error)' : timerWarn ? 'var(--warning)' : 'var(--text-primary)' }}>
            {fmtTimer(secsLeft)}
          </div>
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${(secsLeft / (WRITE_MINS * 60)) * 100}%`,
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
              <img src={schedule.writing_task1_image_url} alt="Task 1 chart/graph"
                className="w-full max-h-72 object-contain" style={{ background: 'var(--bg-secondary)' }} />
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
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Sizning javobingiz</label>
              <span className="text-xs" style={{ color: wordCount(task1) >= 150 ? 'var(--success)' : 'var(--warning)' }}>
                {wordCount(task1)} so&apos;z (min. 150)
              </span>
            </div>
            <textarea className="input-field text-sm resize-none leading-relaxed" rows={10}
              placeholder="Task 1 javobingizni shu yerga yozing..."
              value={task1} onChange={e => onChangeTask1(e.target.value)} />
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
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Sizning javobingiz</label>
              <span className="text-xs" style={{ color: wordCount(task2) >= 250 ? 'var(--success)' : 'var(--warning)' }}>
                {wordCount(task2)} so&apos;z (min. 250)
              </span>
            </div>
            <textarea className="input-field text-sm resize-none leading-relaxed" rows={14}
              placeholder="Task 2 javobingizni shu yerga yozing..."
              value={task2} onChange={e => onChangeTask2(e.target.value)} />
          </div>
        </div>

        <button type="button" onClick={onSubmit} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
          {submitting
            ? <><Loader2 size={18} className="animate-spin" /> Topshirilmoqda…</>
            : <><Send size={18} /> Mock Test ni topshirish</>}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MockTestFlow — main export
   ═══════════════════════════════════════════════════════════════════════ */
export function MockTestFlow({ schedule }: { schedule: MockScheduleForFlow }) {
  const storageKey = `mock_draft_${schedule.id}`

  /* ── State ── */
  const [step,             setStep]            = useState<Step>('pre-start')
  const [startTime,        setStartTime]       = useState<Date | null>(null)
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({})
  const [task1,            setTask1]           = useState('')
  const [task2,            setTask2]           = useState('')
  const [submitting,       setSubmitting]      = useState(false)
  const [lastSaved,        setLastSaved]       = useState<Date | null>(null)
  const [skippedNotice,    setSkippedNotice]   = useState<string | null>(null)
  const [nowMs,            setNowMs]           = useState(Date.now())

  /* ── 1-second clock (drives section timers) ── */
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  /* ── Load draft + compute resume step on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const draft = JSON.parse(raw) as {
        startTime?: string
        step?: Step
        listeningAnswers?: Record<string, string>
        task1?: string
        task2?: string
      }

      if (draft.listeningAnswers) setListeningAnswers(draft.listeningAnswers)
      if (draft.task1)            setTask1(draft.task1)
      if (draft.task2)            setTask2(draft.task2)

      if (draft.startTime) {
        const st = new Date(draft.startTime)
        setStartTime(st)

        const elapsedMs   = Date.now() - st.getTime()
        const resumeStep  = stepFromElapsed(elapsedMs)
        const savedStep   = draft.step ?? 'listening'

        const stepOrder: Step[] = ['pre-start', 'listening', 'reading', 'writing', 'done']
        const timeDerivedIdx    = stepOrder.indexOf(resumeStep)
        const savedIdx          = stepOrder.indexOf(savedStep)
        const finalStep         = timeDerivedIdx > savedIdx ? resumeStep : savedStep

        setStep(finalStep)

        if (finalStep === 'reading' && savedStep === 'listening') {
          setSkippedNotice("Listening bo'limi o'tkazib yuborildi. Reading boshlandi.")
        } else if (finalStep === 'writing' && (savedStep === 'listening' || savedStep === 'reading')) {
          const msg = savedStep === 'listening'
            ? "Listening va Reading bo'limlari o'tkazib yuborildi."
            : "Reading bo'limi o'tkazib yuborildi."
          setSkippedNotice(`${msg} Writing boshlandi.`)
        }
      }
    } catch { /* ignore corrupt draft */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Section secsLeft ── */
  const secsLeft = useMemo<number>(() => {
    if (!startTime) return 0
    const startMs = startTime.getTime()
    let endMs: number
    if      (step === 'listening') endMs = startMs + LISTEN_END_MS
    else if (step === 'reading')   endMs = startMs + READ_END_MS
    else if (step === 'writing')   endMs = startMs + WRITE_END_MS
    else return 0
    return Math.max(0, Math.floor((endMs - nowMs) / 1000))
  }, [startTime, step, nowMs])

  /* ── Auto-advance when section timer expires ── */
  useEffect(() => {
    if (step === 'pre-start' || step === 'done') return
    if (secsLeft !== 0) return
    if (step === 'listening') {
      setSkippedNotice(null); setStep('reading')
    } else if (step === 'reading') {
      setSkippedNotice(null); setStep('writing')
    } else if (step === 'writing' && !submitting) {
      handleFinalSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft, step])

  /* ── Auto-save draft every 30 s ── */
  const saveDraft = useCallback((
    currentStep: Step,
    currentStartTime: Date | null,
    currentListening: Record<string, string>,
    currentTask1: string,
    currentTask2: string,
  ) => {
    if (currentStep === 'done' || currentStep === 'pre-start') return
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        startTime: currentStartTime?.toISOString() ?? null,
        step: currentStep,
        listeningAnswers: currentListening,
        task1: currentTask1,
        task2: currentTask2,
        savedAt: new Date().toISOString(),
      }))
    } catch { /* quota */ }

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
      .catch(() => {})
  }, [storageKey, schedule.id])

  const stateRef = useRef({ step, startTime, listeningAnswers, task1, task2 })
  useEffect(() => {
    stateRef.current = { step, startTime, listeningAnswers, task1, task2 }
  }, [step, startTime, listeningAnswers, task1, task2])

  useEffect(() => {
    const iv = setInterval(() => {
      const { step: s, startTime: st, listeningAnswers: la, task1: t1, task2: t2 } = stateRef.current
      saveDraft(s, st, la, t1, t2)
    }, AUTOSAVE_MS)
    return () => clearInterval(iv)
  }, [saveDraft])

  /* ── Start test ── */
  const handleStart = useCallback(() => {
    const now = new Date()
    try {
      const existing = localStorage.getItem(storageKey)
      const draft    = existing ? JSON.parse(existing) : {}
      localStorage.setItem(storageKey, JSON.stringify({
        ...draft,
        startTime: now.toISOString(),
        step: 'listening',
        savedAt: now.toISOString(),
      }))
    } catch { /* ok */ }
    setStartTime(now)
    setStep('listening')
  }, [storageKey])

  /* ── Final submit ── */
  const handleFinalSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const { listeningAnswers: la, task1: t1, task2: t2 } = stateRef.current
      const res = await fetch('/api/mock/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: schedule.id,
          listening_answers: la,
          writing_task1: t1,
          writing_task2: t2,
          status: 'submitted',
        }),
      })
      if (res.ok) {
        try { localStorage.removeItem(storageKey) } catch { /* ok */ }
        setStep('done')
      }
    } catch (err) {
      console.error('[MockTestFlow] submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, schedule.id, storageKey])

  /* ── Dismiss skipped notice after 6 s ── */
  useEffect(() => {
    if (!skippedNotice) return
    const t = setTimeout(() => setSkippedNotice(null), 6000)
    return () => clearTimeout(t)
  }, [skippedNotice])

  /* ═══════════════ PRE-START SCREEN ═════════════════════════════════ */
  if (step === 'pre-start') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 overflow-y-auto"
        style={{ background: 'var(--bg-primary)' }}>
        <div className="card p-8 max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)', border: '2px solid rgba(99,102,241,0.3)' }}>
            <Play size={36} style={{ color: 'var(--accent)' }} />
          </div>

          <div>
            <h2 className="text-xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>
              Mock IELTS Test
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {schedule.date} — {schedule.time.slice(0, 5)}
            </p>
          </div>

          <div className="space-y-2 text-sm text-left rounded-xl p-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {[
              { icon: Headphones, label: 'Listening', mins: LISTEN_MINS, color: 'var(--success)' },
              { icon: BookOpen,   label: 'Reading',   mins: READ_MINS,   color: 'var(--accent)'  },
              { icon: PenTool,    label: 'Writing',   mins: WRITE_MINS,  color: 'var(--warning)' },
            ].map(({ icon: Icon, label, mins, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={14} style={{ color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </div>
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{mins} daqiqa</span>
              </div>
            ))}
            <div className="pt-2 border-t flex items-center justify-between font-semibold"
              style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-primary)' }}>Jami</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {LISTEN_MINS + READ_MINS + WRITE_MINS} daqiqa
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl text-xs text-left flex gap-2"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--warning)' }}>
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Testni boshlaganingizdan so&apos;ng har bo&apos;lim uchun vaqt tiklanadi.
              Vaqt tugaganda keyingi bo&apos;limga o&apos;tiladi.
            </span>
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-base hover:opacity-90 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}>
            <Play size={18} /> Testni boshlash
          </button>

          <Link href="/mock-test" className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ← Orqaga qaytish
          </Link>
        </div>
      </div>
    )
  }

  /* ═══════════════ DONE SCREEN ═══════════════════════════════════════ */
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 p-6"
        style={{ background: 'var(--bg-primary)' }}>
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
        <Link href="/mock-test"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white"
          style={{ background: 'var(--accent)' }}>
          Mock Test sahifasiga qaytish
        </Link>
      </div>
    )
  }

  /* ═══════════════ ACTIVE TEST ════════════════════════════════════════
     Full-screen: fixed inset-0 z-[100], flex column.
     Top bar is fixed-height; content area fills the rest.
     Each section manages its own scroll / height internally.
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Top bar ── */}
      <div className="shrink-0 px-4 py-3"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
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

      {/* ── Skipped section banner ── */}
      {skippedNotice && (
        <div className="shrink-0 px-4 pt-2 pb-1">
          <div className="max-w-5xl mx-auto flex items-start gap-2 p-3 rounded-xl text-sm"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)' }}>
            <Info size={14} className="shrink-0 mt-0.5" />
            {skippedNotice}
          </div>
        </div>
      )}

      {/* ── Section content — fills all remaining height ── */}
      <div className="flex-1 min-h-0">
        {step === 'listening' && (
          <ListeningSection
            fileUrl={schedule.listening_file_url}
            answers={listeningAnswers}
            onChange={setListeningAnswers}
            onNext={() => { setSkippedNotice(null); setStep('reading') }}
            secsLeft={secsLeft}
          />
        )}
        {step === 'reading' && (
          <ReadingSection
            fileUrl={schedule.reading_file_url}
            onNext={() => { setSkippedNotice(null); setStep('writing') }}
            secsLeft={secsLeft}
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
            secsLeft={secsLeft}
          />
        )}
      </div>
    </div>
  )
}
