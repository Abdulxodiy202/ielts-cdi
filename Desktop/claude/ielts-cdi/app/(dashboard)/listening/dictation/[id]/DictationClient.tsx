'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ChevronLeft, ChevronRight, Check, RefreshCw, RotateCcw,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Dictation {
  id: number
  title: string
  description: string | null
  audio_url: string
  transcript: string
  order_index: number
  difficulty: string
  is_premium: boolean
  duration_seconds: number | null
}

interface Progress {
  best_accuracy: number
  attempts: number
  is_completed: boolean
  stars: number
}

interface DictationClientProps {
  dictation: Dictation
  progress: Progress | null
  isPremium: boolean
  isTestUser: boolean
}

// ── Accuracy algorithm ────────────────────────────────────────────────────────

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

function buildLCS(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

type RawWord = { word: string; type: 'correct' | 'missing' | 'extra' }

type AlignmentItem =
  | { status: 'correct'; origWord: string }
  | { status: 'wrong'; origWord: string; userWord: string }
  | { status: 'missing'; origWord: string }
  | { status: 'extra'; userWord: string }

type DiffStats = { totalWords: number; correctCount: number; missingCount: number; extraCount: number }

// Pair up adjacent missing/extra runs into 'wrong' (substitution) entries so
// the UI can show "you typed X, correct was Y" instead of two disjoint chips.
function pairSubstitutions(raw: RawWord[]): AlignmentItem[] {
  const out: AlignmentItem[] = []
  let i = 0
  while (i < raw.length) {
    const item = raw[i]
    if (item.type === 'correct') {
      out.push({ status: 'correct', origWord: item.word })
      i++
      continue
    }
    let j = i
    const missing: string[] = []
    const extra: string[] = []
    while (j < raw.length && raw[j].type !== 'correct') {
      if (raw[j].type === 'missing') missing.push(raw[j].word)
      else extra.push(raw[j].word)
      j++
    }
    const pairCount = Math.min(missing.length, extra.length)
    for (let k = 0; k < pairCount; k++) {
      out.push({ status: 'wrong', origWord: missing[k], userWord: extra[k] })
    }
    for (let k = pairCount; k < missing.length; k++) {
      out.push({ status: 'missing', origWord: missing[k] })
    }
    for (let k = pairCount; k < extra.length; k++) {
      out.push({ status: 'extra', userWord: extra[k] })
    }
    i = j
  }
  return out
}

function computeDiff(
  userText: string,
  correctText: string
): { alignment: AlignmentItem[]; accuracy: number; stats: DiffStats } {
  const userWords    = normalizeWords(userText)
  const correctWords = normalizeWords(correctText)

  if (correctWords.length === 0) {
    return { alignment: [], accuracy: 100, stats: { totalWords: 0, correctCount: 0, missingCount: 0, extraCount: 0 } }
  }
  if (userWords.length === 0) {
    return {
      alignment: correctWords.map(w => ({ status: 'missing', origWord: w })),
      accuracy: 0,
      stats: { totalWords: correctWords.length, correctCount: 0, missingCount: correctWords.length, extraCount: 0 },
    }
  }

  // LCS aligns words that match AT THE SAME RELATIVE POSITION in both texts
  // (a subsequence, not "appears anywhere") — random reordered words score low.
  const dp  = buildLCS(userWords, correctWords)
  const ops: Array<'correct' | 'extra' | 'missing'> = []
  let i = userWords.length, j = correctWords.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && userWords[i - 1] === correctWords[j - 1]) {
      ops.push('correct'); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push('missing'); j--
    } else {
      ops.push('extra'); i--
    }
  }

  ops.reverse()
  const raw: RawWord[] = []
  let ui = 0, ci = 0

  for (const op of ops) {
    if (op === 'correct') {
      raw.push({ word: correctWords[ci], type: 'correct' }); ui++; ci++
    } else if (op === 'missing') {
      raw.push({ word: correctWords[ci], type: 'missing' }); ci++
    } else {
      raw.push({ word: userWords[ui], type: 'extra' }); ui++
    }
  }

  const alignment    = pairSubstitutions(raw)
  const correctCount = raw.filter(r => r.type === 'correct').length
  const extraCount   = alignment.filter(a => a.status === 'extra').length
  const accuracy     = Math.round((correctCount / correctWords.length) * 100)

  return {
    alignment,
    accuracy,
    stats: {
      totalWords: correctWords.length,
      correctCount,
      missingCount: correctWords.length - correctCount,
      extraCount,
    },
  }
}

function computeStars(accuracy: number): number {
  if (accuracy >= 95) return 5
  if (accuracy >= 90) return 4
  if (accuracy >= 85) return 3
  if (accuracy >= 80) return 2
  if (accuracy >= 75) return 1
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────

const RATES = [0.75, 1, 1.25, 1.5]

export function DictationClient({
  dictation,
  progress,
  isPremium,
  isTestUser,
}: DictationClientProps) {
  const { t } = useLanguage()
  const router = useRouter()

  // Audio
  const audioRef    = useRef<HTMLAudioElement>(null)
  const [playing,   setPlaying]   = useState(false)
  const [curTime,   setCurTime]   = useState(0)
  const [duration,  setDuration]  = useState(dictation.duration_seconds ?? 0)
  const [muted,     setMuted]     = useState(false)
  const [rate,      setRate]      = useState(1)

  // Exercise
  const [userText,  setUserText]  = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [accuracy,  setAccuracy]  = useState(0)
  const [stars,     setStars]     = useState(0)
  const [alignment, setAlignment] = useState<AlignmentItem[]>([])
  const [stats,     setStats]     = useState<DiffStats>({ totalWords: 0, correctCount: 0, missingCount: 0, extraCount: 0 })
  const [visStars,  setVisStars]  = useState(0)

  // Restore draft
  useEffect(() => {
    const draft = localStorage.getItem(`dictation_${dictation.id}_draft`)
    if (draft) setUserText(draft)
  }, [dictation.id])

  // Auto-save draft every 5 s
  useEffect(() => {
    if (submitted) return
    const id = setInterval(() => {
      localStorage.setItem(`dictation_${dictation.id}_draft`, userText)
    }, 5000)
    return () => clearInterval(id)
  }, [userText, submitted, dictation.id])

  // Audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration)
    const onEnd  = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  // Animate stars after submit
  useEffect(() => {
    if (!submitted) return
    setVisStars(0)
    let count = 0
    const id = setInterval(() => {
      count++
      setVisStars(count)
      if (count >= stars) clearInterval(id)
    }, 200)
    return () => clearInterval(id)
  }, [submitted, stars])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }, [playing])

  const seek = useCallback((delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta))
  }, [])

  const seekTo = useCallback((fraction: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = fraction * (audio.duration || 0)
  }, [])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !muted
    setMuted(m => !m)
  }, [muted])

  const changeRate = useCallback((r: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = r
    setRate(r)
  }, [])

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleCheck = async () => {
    const { alignment: align, accuracy: acc, stats: st } = computeDiff(userText, dictation.transcript)
    const s = computeStars(acc)
    setAccuracy(acc)
    setStars(s)
    setAlignment(align)
    setStats(st)
    setSubmitted(true)
    localStorage.removeItem(`dictation_${dictation.id}_draft`)

    setSaving(true)
    try {
      await fetch('/api/dictation/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dictation_id: dictation.id,
          accuracy: acc,
          stars: s,
          is_completed: acc >= 70,
        }),
      })
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleRetry = () => {
    setSubmitted(false)
    setUserText('')
    setAlignment([])
    setStats({ totalWords: 0, correctCount: 0, missingCount: 0, extraCount: 0 })
    setAccuracy(0)
    setStars(0)
    setVisStars(0)
    const audio = audioRef.current
    if (audio) { audio.currentTime = 0; audio.pause(); setPlaying(false) }
  }

  const passed = accuracy >= 70

  const RESULT_MSGS = [
    t('dictation.result0'),
    t('dictation.result1'),
    t('dictation.result2'),
    t('dictation.result3'),
    t('dictation.result4'),
    t('dictation.result5'),
  ]

  // ── Result screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Score card */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center mb-6"
        >
          {/* Stars */}
          <div className="flex justify-center gap-2 mb-5">
            {[1, 2, 3, 4, 5].map(i => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  visStars >= i
                    ? { scale: 1, opacity: 1 }
                    : { scale: 0.3, opacity: 0.2 }
                }
                transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                style={{
                  fontSize: 34,
                  filter: visStars >= i ? 'drop-shadow(0 0 6px gold)' : 'none',
                  display: 'inline-block',
                }}
              >
                {visStars >= i ? '⭐' : '☆'}
              </motion.span>
            ))}
          </div>

          {/* Accuracy */}
          <div
            className="text-5xl font-bold mb-1"
            style={{ color: passed ? 'var(--success)' : '#ef4444' }}
          >
            {accuracy}%
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {t('dictation.accuracy')}
          </p>

          {/* Pass / Fail pill */}
          <div
            className="inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-4"
            style={{
              background: passed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color:      passed ? 'var(--success)'        : '#ef4444',
            }}
          >
            {passed ? t('dictation.passed') : t('dictation.failed')}
          </div>

          <p style={{ color: 'var(--text-muted)' }}>{RESULT_MSGS[stars]}</p>
        </motion.div>

        {/* Detailed stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5 mb-6 grid grid-cols-4 gap-3 text-center"
        >
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stats.totalWords}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Jami so&apos;z</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--success)' }}>{stats.correctCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>To&apos;g&apos;ri</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: '#ef4444' }}>{stats.missingCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Yetishmaydi</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{stats.extraCount}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Ortiqcha</div>
          </div>
        </motion.div>

        {/* Word diff */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6 mb-6"
        >
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {t('dictation.yourAnswer')}
          </h3>
          <div className="flex flex-wrap gap-1.5 leading-loose">
            {alignment.map((item, idx) => {
              if (item.status === 'correct') {
                return (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-sm"
                    style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)' }}
                  >
                    {item.origWord}
                  </span>
                )
              }
              if (item.status === 'wrong') {
                return (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-sm flex flex-col items-center"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', lineHeight: 1.2 }}
                  >
                    <span style={{ textDecoration: 'line-through' }}>{item.userWord}</span>
                    <span style={{ fontSize: 11, color: 'var(--success)' }}>{item.origWord}</span>
                  </span>
                )
              }
              if (item.status === 'missing') {
                return (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-sm"
                    style={{
                      background: 'rgba(148,163,184,0.15)',
                      color: 'var(--text-muted)',
                      textDecoration: 'underline',
                    }}
                  >
                    {item.origWord}
                  </span>
                )
              }
              // extra
              return (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded text-sm flex flex-col items-center"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', lineHeight: 1.2 }}
                >
                  <span>{item.userWord}</span>
                  <span style={{ fontSize: 10 }}>(qo&apos;shimcha)</span>
                </span>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <span>🟢 To&apos;g&apos;ri</span>
            <span>🔴 Yetishmaydi</span>
            <span>⚪ O&apos;tkazib yuborilgan</span>
            <span>🟠 Ortiqcha</span>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleRetry} className="btn-outline flex items-center gap-2">
            <RotateCcw size={15} /> {t('dictation.retry')}
          </button>
          <button
            onClick={() => router.push('/listening/dictation')}
            className="btn-primary flex items-center gap-2"
          >
            {t('dictation.next')} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  // ── Exercise screen ───────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => router.push('/listening/dictation')}
        className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={16} /> {t('common.back')}
      </button>

      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {dictation.title}
        </h1>
        {dictation.description && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {dictation.description}
          </p>
        )}
        {progress && (
          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>
              {t('dictation.bestAccuracy')}:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{progress.best_accuracy}%</strong>
            </span>
            <span>·</span>
            <span>
              {t('dictation.attempts')}:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{progress.attempts}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} src={dictation.audio_url} preload="metadata" />

      {/* Custom player */}
      <div className="card p-5 mb-6">
        {/* Seek bar */}
        <div
          className="relative h-2 rounded-full mb-3 cursor-pointer"
          style={{ background: 'var(--bg-secondary)' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            seekTo((e.clientX - rect.left) / rect.width)
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${duration > 0 ? (curTime / duration) * 100 : 0}%`,
              background: 'var(--accent)',
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Time */}
        <div className="flex justify-between text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          <span>{fmt(curTime)}</span>
          <span>{fmt(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2">
          {/* Skip −5 s */}
          <button
            onClick={() => seek(-5)}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <SkipBack size={18} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>

          {/* Skip +5 s */}
          <button
            onClick={() => seek(5)}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <SkipForward size={18} />
          </button>

          {/* Volume toggle */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Speed buttons */}
          <div className="flex gap-1">
            {RATES.map(r => (
              <button
                key={r}
                onClick={() => changeRate(r)}
                className="px-2 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: rate === r ? 'var(--accent)' : 'var(--bg-secondary)',
                  color:      rate === r ? '#fff'           : 'var(--text-muted)',
                }}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div className="card p-5 mb-6">
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          {t('dictation.instructions')}
        </p>
        <textarea
          value={userText}
          onChange={e => setUserText(e.target.value)}
          rows={7}
          placeholder="Type what you hear..."
          className="w-full p-3 rounded-xl text-sm resize-none outline-none"
          style={{
            background: 'var(--bg-secondary)',
            color:      'var(--text-primary)',
            border:     '1px solid var(--border)',
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleCheck}
          disabled={!userText.trim() || saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-40"
        >
          <Check size={15} /> {t('dictation.check')}
        </button>
        <button
          onClick={() => setUserText('')}
          className="btn-outline flex items-center gap-2"
        >
          <RefreshCw size={15} /> {t('dictation.clear')}
        </button>
      </div>
    </div>
  )
}
