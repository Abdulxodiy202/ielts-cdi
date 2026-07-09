'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { formatTime } from '@/lib/utils/formatters'
import { computeAlignment, getStars, isPassed, type AlignmentResult } from '@/lib/utils/scriptGrading'
import {
  ChevronLeft, Play, Pause, RotateCcw, Volume2,
  SkipForward, SkipBack, Star,
} from 'lucide-react'

interface Script {
  id: number
  title: string
  description: string | null
  audio_url: string
  transcript: string
  duration_seconds: number | null
  order_index: number
  is_premium: boolean
}

type PageStatus = 'loading' | 'error' | 'exercise' | 'result'
const SPEEDS = [0.75, 1, 1.25, 1.5] as const
const MIN_WORDS = 3

const STAR_MESSAGE_KEYS = [
  'script.result.stars0',
  'script.result.stars1',
  'script.result.stars2',
  'script.result.stars3',
  'script.result.stars4',
  'script.result.stars5',
] as const

export default function ScriptExercisePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLanguage()
  const scriptId = params.id

  const [status, setStatus] = useState<PageStatus>('loading')
  const [script, setScript] = useState<Script | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<AlignmentResult | null>(null)

  /* ── Audio player state ───────────────────────────────────────────── */
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<typeof SPEEDS[number]>(1)
  const [volume, setVolume] = useState(1)

  /* ── Auth guard ───────────────────────────────────────────────────── */
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
    })
  }, [router])

  /* ── Load script ──────────────────────────────────────────────────── */
  useEffect(() => {
    setStatus('loading')
    setResult(null)
    fetch(`/api/script/${scriptId}`).then(async res => {
      if (!res.ok) { setStatus('error'); return }
      const data: Script = await res.json()
      setScript(data)
      // Restore draft from localStorage if it exists
      const draft = localStorage.getItem(`script_${scriptId}_draft`)
      setAnswer(draft ?? '')
      setStatus('exercise')
    }).catch(() => setStatus('error'))
  }, [scriptId])

  /* ── Auto-save draft every 5s ─────────────────────────────────────── */
  useEffect(() => {
    if (status !== 'exercise') return
    const id = setInterval(() => {
      localStorage.setItem(`script_${scriptId}_draft`, answer)
    }, 5000)
    return () => clearInterval(id)
  }, [status, scriptId, answer])

  /* ── Audio element wiring ─────────────────────────────────────────── */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDuration = () => setDuration(audio.duration || 0)
    const onEnded = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDuration)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [script])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play()
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const seekBy = useCallback((delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + delta))
  }, [duration])

  const seekTo = useCallback((fraction: number) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    audio.currentTime = fraction * duration
  }, [duration])

  const wordCount = useMemo(() => answer.trim().split(/\s+/).filter(Boolean).length, [answer])

  function handleClear() {
    setAnswer('')
    localStorage.removeItem(`script_${scriptId}_draft`)
  }

  async function handleCheck() {
    if (!script || wordCount < MIN_WORDS) return
    const r = computeAlignment(answer, script.transcript)
    setResult(r)
    setStatus('result')
    localStorage.removeItem(`script_${scriptId}_draft`)

    const stars = getStars(r.accuracy)
    const passed = isPassed(r.accuracy)
    await fetch('/api/script/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script_id: Number(scriptId),
        accuracy: r.accuracy,
        stars,
        is_completed: passed,
        last_answer: answer,
      }),
    }).catch(() => { /* progress save is best-effort; result already shown */ })
  }

  function handleRetry() {
    setResult(null)
    setStatus('exercise')
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (status === 'error' || !script) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto text-center">
        <p style={{ color: 'var(--error)' }}>{t('script.loadError')}</p>
        <Link href="/listening/script" className="btn-outline text-sm mt-4 inline-flex">{t('test.backToModes')}</Link>
      </div>
    )
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <audio ref={audioRef} src={script.audio_url} preload="metadata" />

      {/* Header */}
      <Link href="/listening/script" className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
        <ChevronLeft size={16} /> {t('test.backToModes')}
      </Link>
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {script.order_index}. {script.title}
      </h1>

      {status === 'exercise' && (
        <>
          {/* Instructions */}
          <div className="card p-4 mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            🎧 {t('script.instructions')}
          </div>

          {/* Audio player */}
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-center gap-6 mb-4">
              <button onClick={() => seekBy(-5)} className="p-2 rounded-full hover:opacity-70" style={{ color: 'var(--text-muted)' }} title="-5s">
                <SkipBack size={20} />
              </button>
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
              </button>
              <button onClick={() => seekBy(5)} className="p-2 rounded-full hover:opacity-70" style={{ color: 'var(--text-muted)' }} title="+5s">
                <SkipForward size={20} />
              </button>
            </div>

            {/* Seekable progress bar */}
            <div
              className="w-full h-2 rounded-full cursor-pointer mb-2"
              style={{ background: 'var(--bg-secondary)' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                seekTo((e.clientX - rect.left) / rect.width)
              }}
            >
              <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'var(--accent)' }} />
            </div>
            <div className="flex items-center justify-between text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              <span>{formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(duration))}</span>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Speed control */}
              <div className="flex items-center gap-1">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={speed === s
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Volume2 size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  style={{ width: 90 }}
                />
              </div>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder={t('script.placeholder')}
            className="input-field resize-y w-full mb-1"
            style={{ minHeight: 400, fontSize: 16, lineHeight: 1.6 }}
          />
          <div className="text-right text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            {t('script.wordsLabel')}: {wordCount}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCheck}
              disabled={wordCount < MIN_WORDS}
              className={`btn-primary flex-1 ${wordCount < MIN_WORDS ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {t('script.check')}
            </button>
            <button onClick={handleClear} className="btn-secondary">
              {t('script.clear')}
            </button>
          </div>
          {wordCount < MIN_WORDS && (
            <p className="text-sm mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
              {t('script.minWordsHint', { count: MIN_WORDS })}
            </p>
          )}
        </>
      )}

      {status === 'result' && result && (
        <ResultScreen
          result={result}
          scriptId={script.id}
          onRetry={handleRetry}
          t={t}
        />
      )}
    </div>
  )
}

function ResultScreen({
  result, scriptId, onRetry, t,
}: {
  result: AlignmentResult
  scriptId: number
  onRetry: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const stars = getStars(result.accuracy)
  const passed = isPassed(result.accuracy)

  return (
    <div>
      {/* Accuracy + stars */}
      <div className="text-center mb-6">
        <div className="text-5xl font-black mb-2" style={{ color: passed ? 'var(--success)' : 'var(--error)' }}>
          {result.accuracy}%
        </div>
        <div className="flex items-center justify-center gap-1 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={24} fill={i < stars ? '#f59e0b' : 'none'} style={{ color: i < stars ? '#f59e0b' : 'var(--border)' }} />
          ))}
        </div>
        <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t(STAR_MESSAGE_KEYS[stars])}</p>
        {result.accuracy < 30 && result.attemptAccuracy > 70 && (
          <p className="text-xs mt-2 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {t('script.result.incompleteButAccurate', { attemptAccuracy: result.attemptAccuracy })}
          </p>
        )}
      </div>

      {/* Stats box */}
      <div className="card p-4 mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('script.result.total')}</p>
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{result.stats.totalOrig}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🟢 {t('script.result.exact')}</p>
          <p className="font-bold" style={{ color: '#10b981' }}>{result.stats.exact}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🟡 {t('script.result.partial')}</p>
          <p className="font-bold" style={{ color: '#f59e0b' }}>{result.stats.partial}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🔴 {t('script.result.missing')}</p>
          <p className="font-bold" style={{ color: '#ef4444' }}>{result.stats.missing}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>⚪ {t('script.result.extra')}</p>
          <p className="font-bold" style={{ color: 'var(--text-muted)' }}>{result.stats.extra}</p>
        </div>
      </div>

      {/* Word-by-word */}
      <div className="card p-4 mb-2 leading-loose">
        {result.alignment.map((item, idx) => {
          if (item.status === 'exact') {
            return (
              <span key={idx} className="inline-block mr-1.5 mb-1.5 px-2 py-0.5 rounded-lg text-sm"
                style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#fff' }}>
                {item.orig}
              </span>
            )
          }
          if (item.status === 'partial') {
            return (
              <span key={idx} className="inline-flex flex-col items-center mr-1.5 mb-1.5 px-2 py-0.5 rounded-lg text-sm relative"
                style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fff' }}>
                {item.user}
                <sub className="text-[10px] leading-none" style={{ color: 'var(--text-muted)' }}>→ {item.orig}</sub>
              </span>
            )
          }
          if (item.status === 'missing') {
            return (
              <span key={idx} className="inline-block mr-1.5 mb-1.5 px-2 py-0.5 rounded-lg text-sm"
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fff' }}>
                {item.orig}
              </span>
            )
          }
          // extra
          return (
            <span key={idx} className="inline-block mr-1.5 mb-1.5 px-2 py-0.5 rounded-lg text-sm line-through"
              style={{ background: 'rgba(107,114,128,0.2)', border: '1px solid rgba(107,114,128,0.4)', color: '#9ca3af' }}>
              {item.user}
            </span>
          )
        })}
      </div>

      {/* Legend */}
      <p className="text-xs mb-8 flex items-center gap-3 flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <span>🟢 {t('script.result.exact')}</span>
        <span>🟡 {t('script.result.partial')}</span>
        <span>🔴 {t('script.result.missing')}</span>
        <span>⚪ {t('script.result.extra')}</span>
      </p>

      {/* Actions */}
      {passed ? (
        <div className="flex gap-3">
          <button onClick={onRetry} className="btn-secondary flex-1">
            <RotateCcw size={14} /> {t('script.retry')}
          </button>
          <Link href={`/listening/script/${scriptId + 1}`} className="btn-primary flex-1 justify-center">
            {t('script.nextScript')}
          </Link>
        </div>
      ) : (
        <div>
          <button onClick={onRetry} className="btn-primary w-full mb-2">
            <RotateCcw size={14} /> {t('script.retry')}
          </button>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{t('script.needsToPass')}</p>
        </div>
      )}
    </div>
  )
}
