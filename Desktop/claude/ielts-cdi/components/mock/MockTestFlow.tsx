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

/* ── Durations ── */
const READ_MINS          = 60
const WRITE_MINS         = 60
const LISTEN_REVIEW_SECS = 120   // 2-minute answer-check window after audio ends
const AUTOSAVE_MS        = 30_000

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

/* ─────────────── Section timer bar (Reading / Writing) ─────────────── */
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
   - Attempts autoplay; if blocked → shows prominent "Audio boshlash" button
   - Once playing: only pause/resume allowed; no seek, no rewind, no replay
   - Calls onEnded() the moment the audio track finishes — the parent uses
     this to start the 2-minute answer-review countdown
   - Uses a ref for onEnded so the stable closure never goes stale
   ───────────────────────────────────────────────────────────────────── */
function AudioPlayer({
  src,
  onEnded,
}: {
  src: string
  onEnded: () => void
}) {
  const audioRef     = useRef<HTMLAudioElement>(null)
  const onEndedRef   = useRef(onEnded)
  // Keep the ref current on every render without re-running the effect
  onEndedRef.current = onEnded

  const [playing,    setPlaying]    = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [ended,      setEnded]      = useState(false)
  const [current,    setCurrent]    = useState(0)
  const [duration,   setDuration]   = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay  = () => { setPlaying(true); setHasStarted(true) }
    const onPause = () => setPlaying(false)
    const onTime  = () => setCurrent(audio.currentTime)
    const onMeta  = () => setDuration(isFinite(audio.duration) ? audio.duration : 0)
    const onEnd   = () => {
      setPlaying(false)
      setEnded(true)
      onEndedRef.current()   // notify parent → start 2-min review
    }

    audio.addEventListener('play',           onPlay)
    audio.addEventListener('pause',          onPause)
    audio.addEventListener('timeupdate',     onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended',          onEnd)

    // Attempt autoplay (user just clicked "Testni boshlash")
    audio.play().catch(() => { /* blocked → fallback button will show */ })

    return () => {
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('timeupdate',     onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended',          onEnd)
    }
  }, []) // intentionally empty — onEnded is handled via ref

  const startAudio = () => { audioRef.current?.play().catch(() => {}) }
  const toggle = () => {
    const audio = audioRef.current
    if (!audio || ended) return
    if (playing) audio.pause(); else audio.play().catch(() => {})
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="space-y-0">
      {/* Always in DOM — keeps the ref and listeners stable */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="auto" style={{ display: 'none' }} />

      {/* Fallback start button — appears when autoplay is blocked */}
      {!hasStarted && (
        <div className="card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)' }}>
            <Volume2 size={28} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Listening Audio
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Brauzer audio avtomatik boshlashga ruxsat bermadi
            </p>
          </div>
          <button type="button" onClick={startAudio}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-white text-base hover:opacity-90 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, var(--success), #059669)' }}>
            <Play size={22} /> ▶ Audio boshlash
          </button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Audio bir marta eshitiladi — orqaga qaytib bo&apos;lmaydi
          </p>
        </div>
      )}

      {/* Player controls — visible once audio has started */}
      {hasStarted && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Volume2 size={20} style={{ color: 'var(--success)' }} />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between text-xs font-mono"
                style={{ color: 'var(--text-muted)' }}>
                <span>{fmtMmSs(current)}</span>
                <span>{duration > 0 ? fmtMmSs(duration) : '--:--'}</span>
              </div>
              {/* Non-seekable progress bar */}
              <div title="Orqaga qaytib bo'lmaydi"
                style={{
                  height: 6, background: 'var(--bg-secondary)',
                  borderRadius: 9999, cursor: 'not-allowed', overflow: 'hidden',
                }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: ended ? 'var(--text-muted)' : 'var(--success)',
                  borderRadius: 9999, transition: 'width 0.8s linear',
                }} />
              </div>
            </div>
            {/* Pause / Resume — ONLY control after audio starts */}
            {!ended ? (
              <button type="button" aria-label={playing ? 'Pauza' : 'Davom ettirish'} onClick={toggle}
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
              ? 'Audio yakunlandi'
              : 'Faqat pauza tugmasi mavjud · Orqaga qaytib bo\'lmaydi'}
          </p>
        </div>
      )}
    </div>
  )
}

/* ──────────────────── Listening Section ────────────────────────────── */
/*
   reviewSecsLeft:
   - null  → audio is still playing (no countdown shown)
   - 0..120 → 2-minute review phase (countdown + "Reading ga o'tish" button)
*/
function ListeningSection({
  fileUrl,
  answers,
  onChange,
  onNext,
  onAudioEnd,
  reviewSecsLeft,
}: {
  fileUrl: string | null
  answers: Record<string, string>
  onChange: (a: Record<string, string>) => void
  onNext: () => void
  onAudioEnd: () => void
  reviewSecsLeft: number | null
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

  /* ── CDI HTML — iframe fills remaining space; no timer ── */
  if (isHtml) {
    if (loading) return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <iframe
            src={blobUrl ?? fileUrl}
            title="Listening test"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          />
          {cdiDone && (
            <button type="button" onClick={onNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95"
              style={{ position: 'absolute', bottom: 16, right: 16, background: 'var(--accent)', zIndex: 10 }}>
              Reading ga o&apos;tish <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ── Audio file ── */
  const inReview = reviewSecsLeft !== null
  const setAnswer = (q: string, val: string) => onChange({ ...answers, [q]: val })

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 896, margin: '0 auto', padding: '16px 16px 40px' }} className="space-y-5">

        {/* ── 2-minute review countdown (appears after audio ends) ── */}
        {inReview && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
            style={{
              background: (reviewSecsLeft ?? 0) < 30
                ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${(reviewSecsLeft ?? 0) < 30
                ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'}`,
            }}>
            <div>
              <p className="font-semibold text-sm"
                style={{ color: (reviewSecsLeft ?? 0) < 30 ? 'var(--error)' : 'var(--warning)' }}>
                2 daqiqa javoblarni tekshiring
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Vaqt tugagach Reading bo&apos;limiga o&apos;tiladi
              </p>
            </div>
            <div
              className={`font-mono font-bold text-2xl tabular-nums shrink-0 ${(reviewSecsLeft ?? 0) < 30 ? 'animate-pulse' : ''}`}
              style={{ color: (reviewSecsLeft ?? 0) < 30 ? 'var(--error)' : 'var(--warning)' }}>
              {fmtTimer(reviewSecsLeft ?? 0)}
            </div>
          </div>
        )}

        {/* ── Audio player (autoplay + pause-only) ── */}
        <AudioPlayer src={fileUrl} onEnded={onAudioEnd} />

        {/* ── 40 answer inputs ── */}
        <div className="card p-5 space-y-4">
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Javoblar (1–40)</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 40 }, (_, i) => {
              const q = String(i + 1)
              return (
                <div key={q} className="flex items-center gap-2">
                  <span className="text-xs w-5 shrink-0 font-mono text-right"
                    style={{ color: 'var(--text-muted)' }}>{q}.</span>
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

        {/* ── "Reading ga o'tish" — only during review period ── */}
        {inReview && (
          <button type="button" onClick={onNext}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--success), #059669)' }}>
            Reading ga o&apos;tish <ArrowRight size={16} />
          </button>
        )}
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
          <button type="button" onClick={onNext}
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
  const [step,               setStep]              = useState<Step>('pre-start')
  const [startTime,          setStartTime]         = useState<Date | null>(null)
  /**
   * listenReviewEndMs: epoch-ms when the 2-minute review window ends.
   * null  → audio hasn't finished yet (no review countdown shown)
   * >0    → review in progress; value counts down to 0, then auto-advances
   */
  const [listenReviewEndMs,  setListenReviewEndMs] = useState<number | null>(null)
  /** When reading actually started (drives the 60-min reading timer) */
  const [readingStartedAt,   setReadingStartedAt]  = useState<Date | null>(null)
  /** When writing actually started (drives the 60-min writing timer) */
  const [writingStartedAt,   setWritingStartedAt]  = useState<Date | null>(null)
  const [listeningAnswers,   setListeningAnswers]  = useState<Record<string, string>>({})
  const [task1,              setTask1]             = useState('')
  const [task2,              setTask2]             = useState('')
  const [submitting,         setSubmitting]        = useState(false)
  const [skippedNotice,      setSkippedNotice]     = useState<string | null>(null)
  const [nowMs,              setNowMs]             = useState(Date.now())

  /* ── 1-second clock (drives all countdowns) ── */
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  /* ── Load draft + resume on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const draft = JSON.parse(raw) as {
        startTime?: string
        step?: Step
        listenReviewEndMs?: number | null
        readingStartedAt?: string | null
        writingStartedAt?: string | null
        listeningAnswers?: Record<string, string>
        task1?: string
        task2?: string
      }

      if (draft.listeningAnswers) setListeningAnswers(draft.listeningAnswers)
      if (draft.task1)            setTask1(draft.task1)
      if (draft.task2)            setTask2(draft.task2)

      if (!draft.startTime) return
      setStartTime(new Date(draft.startTime))

      let resumeStep: Step = draft.step ?? 'listening'

      // Listening: check if review was in progress / already over
      if (resumeStep === 'listening' && draft.listenReviewEndMs) {
        if (draft.listenReviewEndMs <= Date.now()) {
          // Review period already ended while offline → skip to reading
          resumeStep = 'reading'
          setReadingStartedAt(new Date())
          setSkippedNotice("Listening bo'limi tugadi. Reading boshlandi.")
        } else {
          setListenReviewEndMs(draft.listenReviewEndMs)
        }
      }

      // Reading: restore per-section start time
      if (resumeStep === 'reading' && draft.readingStartedAt) {
        setReadingStartedAt(new Date(draft.readingStartedAt))
      }

      // Writing: restore per-section start time
      if (resumeStep === 'writing' && draft.writingStartedAt) {
        setWritingStartedAt(new Date(draft.writingStartedAt))
      }

      setStep(resumeStep)
    } catch { /* ignore corrupt draft */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Section secsLeft ──
     Listening: 2-minute review countdown (0 when audio not done)
     Reading:   60-min from readingStartedAt
     Writing:   60-min from writingStartedAt
  ── */
  const secsLeft = useMemo<number>(() => {
    if (step === 'listening') {
      if (!listenReviewEndMs) return 0
      return Math.max(0, Math.floor((listenReviewEndMs - nowMs) / 1000))
    }
    if (step === 'reading') {
      if (!readingStartedAt) return 0
      return Math.max(0, Math.floor(
        (readingStartedAt.getTime() + READ_MINS * 60 * 1000 - nowMs) / 1000
      ))
    }
    if (step === 'writing') {
      if (!writingStartedAt) return 0
      return Math.max(0, Math.floor(
        (writingStartedAt.getTime() + WRITE_MINS * 60 * 1000 - nowMs) / 1000
      ))
    }
    return 0
  }, [step, nowMs, listenReviewEndMs, readingStartedAt, writingStartedAt])

  /* ── Auto-advance when section timer hits 0 ──
     Listening: only advances after review period ends (listenReviewEndMs set)
     Reading / Writing: standard timer expiry
  ── */
  useEffect(() => {
    if (step === 'pre-start' || step === 'done') return
    if (secsLeft !== 0) return

    if (step === 'listening') {
      // Guard: secsLeft is 0 before audio ends too — wait for review to start
      if (!listenReviewEndMs) return
      const now = new Date()
      setListenReviewEndMs(null)
      setStep('reading')
      setReadingStartedAt(now)
      setSkippedNotice(null)
    } else if (step === 'reading') {
      const now = new Date()
      setStep('writing')
      setWritingStartedAt(now)
      setSkippedNotice(null)
    } else if (step === 'writing' && !submitting) {
      handleFinalSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft, step, listenReviewEndMs])

  /* ── Called by AudioPlayer when audio track ends ── */
  const handleAudioEnd = useCallback(() => {
    setListenReviewEndMs(Date.now() + LISTEN_REVIEW_SECS * 1000)
  }, [])

  /* ── Auto-save draft every 30 s ── */
  const saveDraft = useCallback((
    s: Step,
    st: Date | null,
    lr: number | null,
    rs: Date | null,
    ws: Date | null,
    la: Record<string, string>,
    t1: string,
    t2: string,
  ) => {
    if (s === 'done' || s === 'pre-start') return
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        startTime:        st?.toISOString() ?? null,
        step:             s,
        listenReviewEndMs: lr,
        readingStartedAt: rs?.toISOString() ?? null,
        writingStartedAt: ws?.toISOString() ?? null,
        listeningAnswers: la,
        task1: t1,
        task2: t2,
        savedAt: new Date().toISOString(),
      }))
    } catch { /* quota */ }

    fetch('/api/mock/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule_id: schedule.id,
        listening_answers: la,
        writing_task1: t1,
        writing_task2: t2,
        status: 'draft',
      }),
    }).catch(() => {})
  }, [storageKey, schedule.id])

  const stateRef = useRef({
    step, startTime, listenReviewEndMs, readingStartedAt, writingStartedAt,
    listeningAnswers, task1, task2,
  })
  useEffect(() => {
    stateRef.current = {
      step, startTime, listenReviewEndMs, readingStartedAt, writingStartedAt,
      listeningAnswers, task1, task2,
    }
  }, [step, startTime, listenReviewEndMs, readingStartedAt, writingStartedAt, listeningAnswers, task1, task2])

  useEffect(() => {
    const iv = setInterval(() => {
      const { step: s, startTime: st, listenReviewEndMs: lr, readingStartedAt: rs,
              writingStartedAt: ws, listeningAnswers: la, task1: t1, task2: t2 } = stateRef.current
      saveDraft(s, st, lr, rs, ws, la, t1, t2)
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
              { icon: Headphones, label: 'Listening', desc: 'Audio tugaguncha',  color: 'var(--success)' },
              { icon: BookOpen,   label: 'Reading',   desc: `${READ_MINS} daqiqa`,  color: 'var(--accent)'  },
              { icon: PenTool,    label: 'Writing',   desc: `${WRITE_MINS} daqiqa`, color: 'var(--warning)' },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={14} style={{ color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </div>
                <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl text-xs text-left flex gap-2"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--warning)' }}>
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Listening audio tugagach 2 daqiqa javoblarni tekshirishga vaqt beriladi,
              so&apos;ng Reading boshladi.
            </span>
          </div>
          <button type="button" onClick={handleStart}
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

  /* ═══════════════ ACTIVE TEST ════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Step progress bar ── */}
      <div className="shrink-0 px-4 py-2.5"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <StepBar current={step} />
      </div>

      {/* ── Skipped section notice ── */}
      {skippedNotice && (
        <div className="shrink-0 px-4 pt-2 pb-1">
          <div className="max-w-5xl mx-auto flex items-start gap-2 p-3 rounded-xl text-sm"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)' }}>
            <Info size={14} className="shrink-0 mt-0.5" />
            {skippedNotice}
          </div>
        </div>
      )}

      {/* ── Section content — fills remaining height ── */}
      <div className="flex-1 min-h-0">
        {step === 'listening' && (
          <ListeningSection
            fileUrl={schedule.listening_file_url}
            answers={listeningAnswers}
            onChange={setListeningAnswers}
            onNext={() => {
              const now = new Date()
              setListenReviewEndMs(null)
              setStep('reading')
              setReadingStartedAt(now)
              setSkippedNotice(null)
            }}
            onAudioEnd={handleAudioEnd}
            reviewSecsLeft={listenReviewEndMs !== null ? secsLeft : null}
          />
        )}
        {step === 'reading' && (
          <ReadingSection
            fileUrl={schedule.reading_file_url}
            onNext={() => {
              const now = new Date()
              setStep('writing')
              setWritingStartedAt(now)
              setSkippedNotice(null)
            }}
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
