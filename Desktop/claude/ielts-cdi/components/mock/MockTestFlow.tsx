'use client'

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import Link from 'next/link'
import {
  Headphones, BookOpen, PenTool, CheckCircle,
  ArrowRight, Loader2, Clock, AlertTriangle, Send,
  ChevronRight, Play, Pause, Info, Volume2, Maximize,
  XCircle, X,
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
const READ_MINS           = 60
const WRITE_MINS          = 60
const LISTEN_REVIEW_SECS  = 120  // 2-minute answer-check window after audio ends
const READ_REVIEW_SECS    = 120  // 2-minute answer-check window after reading ends
const AUTOSAVE_MS         = 30_000

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
    // Safety: some HTML tests reference 'dropZone' in a scope where it is not declared.
    // Defining it as null on window prevents a ReferenceError that would otherwise abort
    // the checkAnswers() function before window.parent.postMessage (CDI_SUBMIT) fires.
    if(typeof window.dropZone==='undefined')window.dropZone=null;
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

/* ─────────────── Step progress bar ─────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════════════
   WarningModal
   ══════════════════════════════════════════════════════════════════════ */
function WarningModal({
  count,
  fullscreenExited,
  onDismiss,
  onRequestFullscreen,
}: {
  count: number
  fullscreenExited: boolean
  onDismiss: () => void
  onRequestFullscreen: () => void
}) {
  const isLast = count >= 2

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.80)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: `2px solid var(--error)`,
        borderRadius: '20px',
        padding: '36px 32px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 0 60px rgba(239,68,68,0.25)',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
        <h2 style={{
          fontSize: 20, fontWeight: 800,
          color: 'var(--error)',
          marginBottom: 10,
        }}>
          Ogohlantirish {count}/2
        </h2>
        <p style={{
          fontSize: 14, color: 'var(--text-secondary)',
          lineHeight: 1.65,
          marginBottom: fullscreenExited ? 20 : 28,
        }}>
          {isLast
            ? 'Oxirgi ogohlantirish! Keyingi qoidabuzarlik testni bekor qiladi.'
            : 'Boshqa oynaga o\'tish qayd etildi. Yana bir marta takrorlansa, test bekor qilinadi.'}
        </p>

        {fullscreenExited ? (
          <div style={{
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 14,
            padding: '16px',
            marginBottom: 0,
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Iltimos, to&apos;liq ekranga qayting
            </p>
            <button
              onClick={() => { onRequestFullscreen(); onDismiss() }}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'var(--error)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Maximize size={16} /> To&apos;liq ekran
            </button>
          </div>
        ) : (
          <button
            onClick={onDismiss}
            style={{
              width: '100%',
              padding: '13px 0',
              background: isLast ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)',
              color: isLast ? 'var(--error)' : 'var(--text-primary)',
              border: `1px solid ${isLast ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Tushundim
          </button>
        )}
      </div>
    </div>
  )
}

/* ──────────── Custom Audio Player ──────────────────────────────────────
   - Attempts autoplay; if blocked → shows prominent "Audio boshlash" button
   - Once playing: only pause/resume allowed; no seek, no rewind, no replay
   - Calls onEnded() the moment the audio track finishes
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
      onEndedRef.current()
    }

    audio.addEventListener('play',           onPlay)
    audio.addEventListener('pause',          onPause)
    audio.addEventListener('timeupdate',     onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended',          onEnd)

    audio.play().catch(() => {})

    return () => {
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('timeupdate',     onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended',          onEnd)
    }
  }, [])

  const startAudio = () => { audioRef.current?.play().catch(() => {}) }
  const toggle = () => {
    const audio = audioRef.current
    if (!audio || ended) return
    if (playing) audio.pause(); else audio.play().catch(() => {})
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="space-y-0">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="auto" style={{ display: 'none' }} />

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
   - null    → audio still playing (or CDI test not yet completed)
   - 0..120  → 2-min review phase

   Transition logic (simple):
   - Timer ticks inside the "Readingga o'tish (M:SS)" button
   - Clicking the button → immediately calls onNext() (no extra wait)
   - When 2-min review timer hits 0 → parent auto-advances via secsLeft useEffect
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

  const onNextRef = useRef(onNext)
  onNextRef.current = onNext
  const onAudioEndRef = useRef(onAudioEnd)
  onAudioEndRef.current = onAudioEnd

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  /* ── CDI HTML: when student clicks "Check answers", start the 2-min review timer ── */
  useEffect(() => {
    if (cdiDone) onAudioEndRef.current()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdiDone])

  useEffect(() => {
    if (!isHtml) return
    const h = (e: MessageEvent) => {
      if (e.data?.type === 'CDI_CHECK_ANSWERS') setCdiDone(true)
      // CDI_SUBMIT: capture user answers from the HTML test and save them
      if (e.data?.type === 'CDI_SUBMIT') {
        const record: Record<string, string> = {}
        for (const item of (e.data.answers ?? [])) {
          const key = String(item.question ?? '')
          const val = String(item.userAnswer ?? '').trim()
          // 'No Answer' / 'Not Answered' → store as empty string
          record[key] = (val === 'No Answer' || val === 'Not Answered') ? '' : val
        }
        onChangeRef.current(record)
        setCdiDone(true)
      }
    }
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

  /* ── CDI HTML iframe ── */
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

          {/* Button appears when CDI test is done; clicking goes directly to Reading */}
          {cdiDone && (
            <button type="button" onClick={() => onNextRef.current()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95"
              style={{
                position: 'absolute', bottom: 16, right: 16, zIndex: 10,
                background: reviewSecsLeft !== null && reviewSecsLeft < 15 ? 'var(--error)' : 'var(--accent)',
                fontSize: 15,
              }}>
              Readingga o&apos;tish
              {reviewSecsLeft !== null && (
                <span style={{ fontFamily: 'monospace' }}>
                  ({Math.floor(reviewSecsLeft / 60)}:{String(reviewSecsLeft % 60).padStart(2, '0')})
                </span>
              )}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ── Audio file ── */
  const inReview  = reviewSecsLeft !== null
  const reviewSecs = reviewSecsLeft ?? 0
  const setAnswer  = (q: string, val: string) => onChange({ ...answers, [q]: val })

  void isAudio

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 896, margin: '0 auto', padding: '16px 16px 8px' }} className="space-y-5">

        {/* ── 2-minute review countdown banner ── */}
        {inReview && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4"
            style={{
              background: reviewSecs < 30 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${reviewSecs < 30 ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'}`,
            }}>
            <div>
              <p className="font-semibold text-sm"
                style={{ color: reviewSecs < 30 ? 'var(--error)' : 'var(--warning)' }}>
                Javoblaringizni tekshiring
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Vaqt tugagach Reading bo&apos;limiga o&apos;tiladi
              </p>
            </div>
            <div
              className={`font-mono font-bold text-2xl tabular-nums shrink-0 ${reviewSecs < 30 ? 'animate-pulse' : ''}`}
              style={{ color: reviewSecs < 30 ? 'var(--error)' : 'var(--warning)' }}>
              {fmtMmSs(reviewSecs)}
            </div>
          </div>
        )}

        {/* ── Audio player ── */}
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
      </div>

      {/* ── Sticky transition button — timer ticking inside; click = go directly to Reading ── */}
      {inReview && (
        <div style={{
          position: 'sticky', bottom: 0, zIndex: 10,
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border)',
          padding: '12px 16px 16px',
        }}>
          <button
            type="button"
            onClick={() => onNextRef.current()}
            className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold text-white hover:opacity-90 active:scale-95 transition-all"
            style={{
              background: reviewSecs < 15 ? 'var(--error)' : 'linear-gradient(135deg, #16a34a, #059669)',
              padding: '16px 24px',
              fontSize: 17,
              letterSpacing: '0.01em',
            }}
          >
            Readingga o&apos;tish
            <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900 }}>
              ({fmtMmSs(reviewSecs)})
            </span>
            <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────── Reading Section ──────────────────────────── */
/*
   reviewSecsLeft:
   - null    → still in active reading (60-min timer running)
   - 0..120  → 2-min review phase after reading ends

   Transition logic (mirrors Listening → Reading):
   - Timer ticks inside the "Writingga o'tish (M:SS)" sticky button
   - Clicking the button immediately calls onNext() (no extra wait)
   - When 2-min review timer hits 0 → parent auto-advances via secsLeft useEffect
   - CDI HTML: cdiDone triggers onReadingDone() → starts review
   - Non-CDI: overlay button calls onReadingDone() → starts review
*/
function ReadingSection({
  fileUrl,
  onNext,
  onReadingDone,
  onReadingAnswers,
  secsLeft,
  reviewSecsLeft,
}: {
  fileUrl: string | null
  onNext: () => void
  onReadingDone: () => void
  onReadingAnswers: (answers: Record<string, string>) => void
  secsLeft: number
  reviewSecsLeft: number | null
}) {
  const ext    = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const isHtml = ext === 'html' || ext === 'htm'
  const { blobUrl, loading } = useHtmlBlobUrl(isHtml ? fileUrl : null)
  const [cdiDone, setCdiDone] = useState(false)

  const onNextRef          = useRef(onNext)
  onNextRef.current        = onNext
  const onReadingDoneRef   = useRef(onReadingDone)
  onReadingDoneRef.current = onReadingDone
  const onReadingAnswersRef = useRef(onReadingAnswers)
  onReadingAnswersRef.current = onReadingAnswers

  /* ── CDI HTML: trigger 2-min review timer when reading is submitted ── */
  useEffect(() => {
    if (cdiDone) onReadingDoneRef.current()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdiDone])

  useEffect(() => {
    if (!isHtml) return
    const h = (e: MessageEvent) => {
      if (e.data?.type === 'CDI_CHECK_ANSWERS') setCdiDone(true)
      // CDI_SUBMIT: capture reading answers from the HTML test
      if (e.data?.type === 'CDI_SUBMIT') {
        const record: Record<string, string> = {}
        for (const item of (e.data.answers ?? [])) {
          const key = String(item.question ?? '')
          const val = String(item.userAnswer ?? '').trim()
          record[key] = (val === 'No Answer' || val === 'Not Answered') ? '' : val
        }
        onReadingAnswersRef.current(record)
        setCdiDone(true)
      }
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [isHtml])

  const inReview   = reviewSecsLeft !== null
  const reviewSecs = reviewSecsLeft ?? 0

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
      {/* SectionTimer — only during active reading, not during review */}
      {!inReview && (
        <div style={{ padding: '10px 16px', flexShrink: 0 }}>
          <SectionTimer secsLeft={secsLeft} totalSecs={READ_MINS * 60} label="Reading vaqti" />
        </div>
      )}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <iframe
          src={(isHtml ? blobUrl : null) ?? fileUrl}
          title="Reading test"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        />
        {/* Overlay button — active reading phase; click starts 2-min review */}
        {!inReview && (!isHtml || cdiDone) && (
          <button type="button" onClick={() => onReadingDoneRef.current()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-xl hover:opacity-90 active:scale-95"
            style={{ position: 'absolute', bottom: 16, right: 16, background: 'var(--accent)', zIndex: 10 }}>
            Writing ga o&apos;tish <ArrowRight size={15} />
          </button>
        )}
        {/* Overlay button — review phase; timer ticking inside; click = go directly to Writing */}
        {inReview && (
          <button
            type="button"
            onClick={() => onNextRef.current()}
            className="flex items-center gap-2 hover:opacity-90 active:scale-95"
            style={{
              position: 'absolute', bottom: 16, right: 16, zIndex: 10,
              padding: '16px 24px',
              background: reviewSecs <= 15
                ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                : 'linear-gradient(135deg, #16a34a, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '17px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '200px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            }}
          >
            Writingga o&apos;tish
            <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900 }}>
              ({fmtMmSs(reviewSecs)})
            </span>
            <ArrowRight size={20} />
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 896, margin: '0 auto', padding: '16px 16px 40px' }} className="space-y-6">
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

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'var(--accent)' }}>1</div>
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Writing Task 1</h3>
          </div>
          {schedule.writing_task1_image_url && (
            <div
              className="group relative rounded-xl overflow-hidden border"
              style={{ borderColor: 'var(--border)', cursor: 'zoom-in' }}
              onClick={() => setLightboxUrl(schedule.writing_task1_image_url)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={schedule.writing_task1_image_url} alt="Task 1 chart/graph"
                className="w-full max-h-72 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                style={{ background: 'var(--bg-secondary)' }} />
              <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-xs px-2 py-1 rounded-lg font-medium"
                  style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                  Kattalashtirish uchun bosing
                </span>
              </div>
            </div>
          )}

          {/* Fullscreen image lightbox — z-[250] so it sits above the WarningModal (z-200) */}
          {lightboxUrl && (
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 250,
                background: 'rgba(0,0,0,0.90)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setLightboxUrl(null)}
            >
              <button
                type="button"
                style={{
                  position: 'absolute', top: 16, right: 16,
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={e => { e.stopPropagation(); setLightboxUrl(null) }}
              >
                <X size={20} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt="Task rasm (katta)"
                style={{
                  maxWidth: '95vw', maxHeight: '95vh',
                  objectFit: 'contain', borderRadius: 12,
                }}
                onClick={e => e.stopPropagation()}
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
  const storageKey     = `mock_draft_${schedule.id}`
  const violationsKey  = `mock_violations_${schedule.id}`

  /* ── State ── */
  const [step,               setStep]              = useState<Step>('pre-start')
  const [startTime,          setStartTime]         = useState<Date | null>(null)
  const [listenReviewEndMs,  setListenReviewEndMs]  = useState<number | null>(null)
  const [readingReviewEndMs, setReadingReviewEndMs] = useState<number | null>(null)
  const [readingStartedAt,   setReadingStartedAt]   = useState<Date | null>(null)
  const [writingStartedAt,   setWritingStartedAt]  = useState<Date | null>(null)
  const [listeningAnswers,   setListeningAnswers]  = useState<Record<string, string>>({})
  const [readingAnswers,     setReadingAnswers]    = useState<Record<string, string>>({})
  const [task1,              setTask1]             = useState('')
  const [task2,              setTask2]             = useState('')
  const [submitting,         setSubmitting]        = useState(false)
  const [skippedNotice,      setSkippedNotice]     = useState<string | null>(null)
  const [nowMs,              setNowMs]             = useState(Date.now())

  /* ── Anti-cheat state ── */
  const [violations,      setViolations]      = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try { return Math.min(3, parseInt(localStorage.getItem(violationsKey) ?? '0', 10) || 0) } catch { return 0 }
  })
  const [warningViolation, setWarningViolation] = useState<number | null>(null) // shown in modal
  const [disqualified,    setDisqualified]    = useState(false)
  const [isFullscreen,    setIsFullscreen]    = useState(false)
  const [fullscreenExited, setFullscreenExited] = useState(false)

  /* ── Anti-cheat refs (avoid stale closures in event listeners) ── */
  const lastViolMs       = useRef(0)
  const warningOpenRef   = useRef(false)
  const disqualifiedRef  = useRef(false)
  const violsRef         = useRef(violations)
  const stepRef          = useRef(step)

  useEffect(() => { violsRef.current        = violations   }, [violations])
  useEffect(() => { stepRef.current         = step         }, [step])
  useEffect(() => { disqualifiedRef.current = disqualified }, [disqualified])
  useEffect(() => { warningOpenRef.current  = warningViolation !== null }, [warningViolation])

  /* ── 1-second clock ── */
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
        readingReviewEndMs?: number | null
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

      if (resumeStep === 'listening' && draft.listenReviewEndMs) {
        if (draft.listenReviewEndMs <= Date.now()) {
          resumeStep = 'reading'
          setReadingStartedAt(new Date())
          setSkippedNotice("Listening bo'limi tugadi. Reading boshlandi.")
        } else {
          setListenReviewEndMs(draft.listenReviewEndMs)
        }
      }
      if (resumeStep === 'reading') {
        if (draft.readingReviewEndMs) {
          if (draft.readingReviewEndMs <= Date.now()) {
            resumeStep = 'writing'
            setWritingStartedAt(new Date())
            setSkippedNotice("Reading bo'limi tugadi. Writing boshlandi.")
          } else {
            setReadingReviewEndMs(draft.readingReviewEndMs)
          }
        }
        if (draft.readingStartedAt) setReadingStartedAt(new Date(draft.readingStartedAt))
      }
      if (resumeStep === 'writing' && draft.writingStartedAt) {
        setWritingStartedAt(new Date(draft.writingStartedAt))
      }

      setStep(resumeStep)
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Section secsLeft ── */
  const secsLeft = useMemo<number>(() => {
    if (step === 'listening') {
      if (!listenReviewEndMs) return 0
      return Math.max(0, Math.floor((listenReviewEndMs - nowMs) / 1000))
    }
    if (step === 'reading') {
      if (readingReviewEndMs !== null) {
        return Math.max(0, Math.floor((readingReviewEndMs - nowMs) / 1000))
      }
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
  }, [step, nowMs, listenReviewEndMs, readingReviewEndMs, readingStartedAt, writingStartedAt])

  /* ── Auto-advance when section timer hits 0 ── */
  useEffect(() => {
    if (step === 'pre-start' || step === 'done') return
    if (secsLeft !== 0) return

    if (step === 'listening') {
      if (!listenReviewEndMs) return
      const now = new Date()
      setListenReviewEndMs(null)
      setStep('reading')
      setReadingStartedAt(now)
      setSkippedNotice(null)
    } else if (step === 'reading') {
      if (!readingReviewEndMs) {
        // 60-min reading timer expired → start 2-min review
        setReadingReviewEndMs(Date.now() + READ_REVIEW_SECS * 1000)
      } else {
        // Review timer expired → advance to Writing
        setReadingReviewEndMs(null)
        const now = new Date()
        setStep('writing')
        setWritingStartedAt(now)
        setSkippedNotice(null)
      }
    } else if (step === 'writing' && !submitting) {
      handleFinalSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secsLeft, step, listenReviewEndMs, readingReviewEndMs])

  /* ── Audio ended → start 2-min Listening review ── */
  const handleAudioEnd = useCallback(() => {
    setListenReviewEndMs(Date.now() + LISTEN_REVIEW_SECS * 1000)
  }, [])

  /* ── Reading done → start 2-min Reading review ── */
  const handleReadingDone = useCallback(() => {
    setReadingReviewEndMs(Date.now() + READ_REVIEW_SECS * 1000)
  }, [])

  /* ── requestFullscreen helper ── */
  const requestFullscreen = useCallback(() => {
    try {
      document.documentElement.requestFullscreen?.()?.catch(() => {})
    } catch { /* unsupported */ }
  }, [])

  /* ── Disqualification ── */
  const handleDisqualification = useCallback(async () => {
    disqualifiedRef.current = true
    setDisqualified(true)
    setWarningViolation(null)
    // Exit fullscreen
    try { document.exitFullscreen?.() } catch {}
    // Send notification + save
    try {
      await fetch('/api/mock/disqualify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: schedule.id }),
      })
    } catch {}
    // Clear localStorage
    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(violationsKey)
    } catch {}
    // Redirect after 3 s
    setTimeout(() => { window.location.href = '/dashboard' }, 3000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.id, storageKey, violationsKey])

  /* ── Record violation ── */
  const recordViolation = useCallback(() => {
    if (disqualifiedRef.current)   return
    if (warningOpenRef.current)    return
    // 2-second debounce to avoid double-counting simultaneous events
    const now = Date.now()
    if (now - lastViolMs.current < 2000) return
    lastViolMs.current = now

    const newCount = violsRef.current + 1
    violsRef.current = newCount
    setViolations(newCount)
    try { localStorage.setItem(violationsKey, String(newCount)) } catch {}

    if (newCount >= 3) {
      handleDisqualification()
    } else {
      setWarningViolation(newCount)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violationsKey, handleDisqualification])

  /* ── Anti-cheat event listeners ──
     Registered after a 2.5 s grace period so fullscreen transitions and
     initial page load don't trigger false violations.
     All five events log to console for debugging.
  ── */
  useEffect(() => {
    if (step === 'pre-start' || step === 'done') return

    // Keep refs to the registered handlers so cleanup always removes the right ones
    let removeAll: (() => void) | null = null

    const timer = setTimeout(() => {
      console.log('[Anti-cheat] Listeners activated for step:', step)

      // 1. visibilitychange — only when tab is actually hidden
      const onVisibility = () => {
        console.log('[Anti-cheat] visibilitychange — hidden:', document.hidden)
        if (document.hidden) recordViolation()
      }

      // 2. blur — check 100ms later if focus moved to an iframe (CDI test click)
      //    If it did, this is a false positive; ignore it.
      const onBlur = () => {
        setTimeout(() => {
          const focused = document.activeElement
          console.log('[Anti-cheat] window.blur — activeElement:', focused?.tagName)
          if (focused && focused.tagName === 'IFRAME') {
            console.log('[Anti-cheat] blur ignored — focus is inside test iframe')
            return
          }
          recordViolation()
        }, 100)
      }

      // 3. focus — informational: user returned to window
      const onFocus = () => {
        console.log('[Anti-cheat] window.focus — user returned')
      }

      // 4. fullscreenchange — only when actually exiting fullscreen
      const onFullscreenChange = () => {
        const inFS = !!document.fullscreenElement
        console.log('[Anti-cheat] fullscreenchange — inFS:', inFS)
        setIsFullscreen(inFS)
        if (inFS) {
          // Entered fullscreen — clear the flag
          setFullscreenExited(false)
        } else {
          // Exited fullscreen — genuine violation
          setFullscreenExited(true)
          recordViolation()
        }
      }

      // NOTE: keydown Alt+Tab removed — it fires from inside the iframe too,
      // causing false positives. visibilitychange is sufficient for tab switches.

      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('blur',               onBlur)
      window.addEventListener('focus',              onFocus)
      document.addEventListener('fullscreenchange', onFullscreenChange)

      removeAll = () => {
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('blur',               onBlur)
        window.removeEventListener('focus',              onFocus)
        document.removeEventListener('fullscreenchange', onFullscreenChange)
        console.log('[Anti-cheat] Listeners removed')
      }
    }, 2500)

    return () => {
      clearTimeout(timer)
      removeAll?.()
    }
  }, [step, recordViolation])

  /* ── Auto-close warning modal when fullscreen resumes ── */
  useEffect(() => {
    if (isFullscreen && warningViolation !== null) {
      setWarningViolation(null)
      setFullscreenExited(false)
    }
  }, [isFullscreen, warningViolation])

  /* ── Exit fullscreen when test ends ── */
  useEffect(() => {
    if ((step === 'done' || disqualified) && document.fullscreenElement) {
      try { document.exitFullscreen?.() } catch {}
    }
  }, [step, disqualified])

  /* ── Auto-save draft every 30 s ── */
  const saveDraft = useCallback((
    s: Step, st: Date | null, lr: number | null, rr: number | null,
    rs: Date | null, ws: Date | null,
    la: Record<string, string>, ra: Record<string, string>,
    t1: string, t2: string,
  ) => {
    if (s === 'done' || s === 'pre-start') return
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        startTime:          st?.toISOString() ?? null,
        step:               s,
        listenReviewEndMs:  lr,
        readingReviewEndMs: rr,
        readingStartedAt:   rs?.toISOString() ?? null,
        writingStartedAt:   ws?.toISOString() ?? null,
        listeningAnswers:   la,
        readingAnswers:     ra,
        task1: t1, task2: t2,
        savedAt: new Date().toISOString(),
      }))
    } catch { /* quota */ }

    fetch('/api/mock/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule_id:       schedule.id,
        listening_answers: la,
        reading_answers:   ra,
        writing_task1:     t1,
        writing_task2:     t2,
        status:            'draft',
      }),
    }).catch(() => {})
  }, [storageKey, schedule.id])

  const stateRef = useRef({
    step, startTime, listenReviewEndMs, readingReviewEndMs, readingStartedAt,
    writingStartedAt, listeningAnswers, readingAnswers, task1, task2,
  })
  useEffect(() => {
    stateRef.current = {
      step, startTime, listenReviewEndMs, readingReviewEndMs, readingStartedAt,
      writingStartedAt, listeningAnswers, readingAnswers, task1, task2,
    }
  }, [step, startTime, listenReviewEndMs, readingReviewEndMs, readingStartedAt, writingStartedAt, listeningAnswers, readingAnswers, task1, task2])

  useEffect(() => {
    const iv = setInterval(() => {
      const { step: s, startTime: st, listenReviewEndMs: lr, readingReviewEndMs: rr,
              readingStartedAt: rs, writingStartedAt: ws,
              listeningAnswers: la, readingAnswers: ra, task1: t1, task2: t2 } = stateRef.current
      saveDraft(s, st, lr, rr, rs, ws, la, ra, t1, t2)
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
    // Request fullscreen — anti-cheat listeners activate 2.5 s after step changes
    requestFullscreen()
  }, [storageKey, requestFullscreen])

  /* ── Final submit ── */
  const handleFinalSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const { listeningAnswers: la, readingAnswers: ra, task1: t1, task2: t2 } = stateRef.current
      const res = await fetch('/api/mock/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id:       schedule.id,
          listening_answers: la,
          reading_answers:   ra,
          writing_task1:     t1,
          writing_task2:     t2,
          status:            'submitted',
        }),
      })
      if (res.ok) {
        try { localStorage.removeItem(storageKey) } catch {}
        try { localStorage.removeItem(violationsKey) } catch {}
        setStep('done')
      }
    } catch (err) {
      console.error('[MockTestFlow] submit error:', err)
    } finally {
      setSubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, schedule.id, storageKey, violationsKey])

  /* ── Dismiss skipped notice after 6 s ── */
  useEffect(() => {
    if (!skippedNotice) return
    const t = setTimeout(() => setSkippedNotice(null), 6000)
    return () => clearTimeout(t)
  }, [skippedNotice])

  /* ═══════════════ DISQUALIFIED OVERLAY ═════════════════════════════ */
  if (disqualified) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: 24,
        textAlign: 'center',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'rgba(239,68,68,0.12)',
          border: '2px solid rgba(239,68,68,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <XCircle size={48} style={{ color: 'var(--error)' }} />
        </div>
        <div style={{ maxWidth: 400 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--error)', marginBottom: 12 }}>
            🚫 Testdan chetlatildingiz
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Siz noqonuniy harakat tufayli testdan chetlatildingiz.
            Dashboard&apos;ga yo&apos;naltirilmoqda…
          </p>
        </div>
        <div style={{
          marginTop: 8,
          width: 40, height: 40,
          borderRadius: '50%',
          border: '3px solid var(--error)',
          borderTopColor: 'transparent',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

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
              { icon: Headphones, label: 'Listening', desc: 'Audio tugaguncha',   color: 'var(--success)' },
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
              Listening tugagach 2 daqiqa javoblarni tekshirishga vaqt beriladi.
              Test to&apos;liq ekranda (fullscreen) o&apos;tkaziladi.
              Tab almashtirish yoki ekrandan chiqish ogohlantirish sanaladi.
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

      {/* ── Section content ── */}
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
              setReadingReviewEndMs(null)
              setStep('writing')
              setWritingStartedAt(now)
              setSkippedNotice(null)
            }}
            onReadingDone={handleReadingDone}
            onReadingAnswers={setReadingAnswers}
            secsLeft={secsLeft}
            reviewSecsLeft={readingReviewEndMs !== null ? secsLeft : null}
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

      {/* ── Warning modal (1st / 2nd violation) ── */}
      {warningViolation !== null && (
        <WarningModal
          count={warningViolation}
          fullscreenExited={fullscreenExited}
          onDismiss={() => {
            setWarningViolation(null)
            if (!fullscreenExited) return
            // If still not in fullscreen after dismissal, keep the flag
          }}
          onRequestFullscreen={() => {
            requestFullscreen()
            setFullscreenExited(false)
          }}
        />
      )}

      {/* ── Fullscreen return prompt (no warning modal, but FS is exited) ── */}
      {fullscreenExited && warningViolation === null && !disqualified && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 195,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 16,
            padding: '28px 24px',
            maxWidth: 360,
            width: '100%',
            textAlign: 'center',
          }}>
            <Maximize size={32} className="mx-auto mb-3" style={{ color: 'var(--warning)' }} />
            <p className="font-semibold mb-3" style={{ color: 'var(--text-primary)', fontSize: 15 }}>
              Iltimos, to&apos;liq ekranga qayting
            </p>
            <button
              onClick={() => { requestFullscreen(); setFullscreenExited(false) }}
              style={{
                width: '100%', padding: '12px 0',
                background: 'var(--warning)', color: 'white',
                border: 'none', borderRadius: 12,
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Maximize size={15} /> To&apos;liq ekran
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
