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
    // Curly/smart quotes (common in Word-sourced .docx transcripts) → straight,
    // so "I'm" (student typing) matches "I'm" (admin's Word autocorrect output).
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    // Hyphens/dashes → space, so "stress-free" and "stress free" both work
    .replace(/[—–-]/g, ' ')
    // Strip remaining punctuation entirely (not replaced with space), so
    // "don't"/"it's" collapse to "dont"/"its" — punctuation is never penalized
    .replace(/['".,?!:;()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 0)
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

type MatchLevel = 'exact' | 'partial' | 'none'

// exact = identical; partial = a small typo (≤2 edits, and that's <30% of the
// word) on words ≥4 chars; anything else (incl. short words) is 'none'.
function compareWords(user: string, orig: string): MatchLevel {
  if (user === orig) return 'exact'
  if (user.length < 4 || orig.length < 4) return 'none'
  // Edit distance is always ≥ the length difference — skip the expensive DP
  // below once that alone rules out 'partial'. Same result, much faster at
  // 1000+ words (verified: identical output to the unoptimized version).
  if (Math.abs(user.length - orig.length) > 2) return 'none'
  const dist = levenshteinDistance(user, orig)
  if (dist <= 2 && dist < Math.max(user.length, orig.length) * 0.3) return 'partial'
  return 'none'
}

type AlignmentItem =
  | { status: 'exact'; origWord: string; userWord: string }
  | { status: 'partial'; origWord: string; userWord: string }
  | { status: 'missing'; origWord: string }
  | { status: 'extra'; userWord: string }

type DiffStats = {
  totalOrig: number
  totalUser: number
  exact: number
  partial: number
  missing: number
  extra: number
}

function computeAlignment(
  userText: string,
  origText: string
): { alignment: AlignmentItem[]; accuracy: number; stats: DiffStats } {
  const userWords = normalizeWords(userText)
  const origWords  = normalizeWords(origText)
  const m = origWords.length
  const n = userWords.length

  if (m === 0) {
    return {
      alignment: userWords.map(w => ({ status: 'extra', userWord: w })),
      accuracy: 100,
      stats: { totalOrig: 0, totalUser: n, exact: 0, partial: 0, missing: 0, extra: n },
    }
  }

  // dp[i][j] = best weighted score aligning origWords[0..i) with userWords[0..j)
  // — exact match = 2 points, partial (typo) match = 1 point — so a partial
  // match is preferred over skipping, but an exact match always wins.
  const dp: number[][] = []
  for (let i = 0; i <= m; i++) dp.push(new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = compareWords(userWords[j - 1], origWords[i - 1])
      if (match === 'exact') {
        dp[i][j] = dp[i - 1][j - 1] + 2
      } else if (match === 'partial') {
        dp[i][j] = Math.max(dp[i - 1][j - 1] + 1, dp[i - 1][j], dp[i][j - 1])
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build the alignment in original transcript order.
  const alignment: AlignmentItem[] = []
  let i = m, j = n
  while (i > 0 && j > 0) {
    const match = compareWords(userWords[j - 1], origWords[i - 1])
    if (match === 'exact' && dp[i][j] === dp[i - 1][j - 1] + 2) {
      alignment.unshift({ status: 'exact', origWord: origWords[i - 1], userWord: userWords[j - 1] })
      i--; j--
    } else if (match === 'partial' && dp[i][j] === dp[i - 1][j - 1] + 1) {
      alignment.unshift({ status: 'partial', origWord: origWords[i - 1], userWord: userWords[j - 1] })
      i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      alignment.unshift({ status: 'missing', origWord: origWords[i - 1] })
      i--
    } else {
      alignment.unshift({ status: 'extra', userWord: userWords[j - 1] })
      j--
    }
  }
  while (i > 0) {
    alignment.unshift({ status: 'missing', origWord: origWords[i - 1] })
    i--
  }
  while (j > 0) {
    alignment.unshift({ status: 'extra', userWord: userWords[j - 1] })
    j--
  }

  const exactCount   = alignment.filter(a => a.status === 'exact').length
  const partialCount = alignment.filter(a => a.status === 'partial').length
  const missingCount = alignment.filter(a => a.status === 'missing').length
  const extraCount   = alignment.filter(a => a.status === 'extra').length

  // Accuracy: exact words count fully, partial (typo) words count half.
  const score    = exactCount + partialCount * 0.5
  const accuracy = Math.round((score / m) * 100)

  if (process.env.NODE_ENV !== 'production') {
    console.log('=== DICTATION DEBUG ===')
    console.log('User input:', userText.slice(0, 100))
    console.log('Normalized user words (first 20):', userWords.slice(0, 20))
    console.log('Original transcript (first 100 chars):', origText.slice(0, 100))
    console.log('Normalized orig words (first 20):', origWords.slice(0, 20))
    console.log('User word count:', userWords.length)
    console.log('Orig word count:', origWords.length)
    console.log('Exact:', exactCount, 'Partial:', partialCount, 'Missing:', missingCount, 'Extra:', extraCount)
    console.log('Score:', score, '/ Denominator:', m)
    console.log('Accuracy:', accuracy, '% -> Stars:', computeStars(accuracy))
    console.log('=== END DEBUG ===')
  }

  return {
    alignment,
    accuracy,
    stats: { totalOrig: m, totalUser: n, exact: exactCount, partial: partialCount, missing: missingCount, extra: extraCount },
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
  const [stats,     setStats]     = useState<DiffStats>({ totalOrig: 0, totalUser: 0, exact: 0, partial: 0, missing: 0, extra: 0 })
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
    const { alignment: align, accuracy: acc, stats: st } = computeAlignment(userText, dictation.transcript)
    const s = computeStars(acc)
    const passedNow = acc >= 70
    setAccuracy(acc)
    setStars(s)
    setAlignment(align)
    setStats(st)
    setSubmitted(true)
    localStorage.removeItem(`dictation_${dictation.id}_draft`)

    setSaving(true)
    try {
      const res = await fetch('/api/dictation/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dictation_id: dictation.id,
          accuracy_percent: acc,
          stars: s,
          is_completed: passedNow,
          last_answer: userText,
        }),
      })
      if (!res.ok && process.env.NODE_ENV !== 'production') {
        console.error('Failed to save dictation progress:', res.status, await res.text())
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to save dictation progress:', err)
    }
    setSaving(false)
  }

  const handleRetry = () => {
    setSubmitted(false)
    setUserText('')
    setAlignment([])
    setStats({ totalOrig: 0, totalUser: 0, exact: 0, partial: 0, missing: 0, extra: 0 })
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
          className="card p-5 mb-6 grid grid-cols-5 gap-2 text-center"
        >
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stats.totalOrig}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Jami</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--success)' }}>{stats.exact}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Aniq to&apos;g&apos;ri</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: '#f59e0b' }}>{stats.partial}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Deyarli to&apos;g&apos;ri</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: '#ef4444' }}>{stats.missing}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Yetishmaydi</div>
          </div>
          <div>
            <div className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>{stats.extra}</div>
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
              if (item.status === 'exact') {
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
              if (item.status === 'partial') {
                return (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded text-sm flex flex-col items-center"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', lineHeight: 1.2 }}
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
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                  >
                    {item.origWord}
                  </span>
                )
              }
              // extra
              return (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded text-sm"
                  style={{
                    background: 'rgba(148,163,184,0.15)',
                    color: 'var(--text-muted)',
                    textDecoration: 'line-through',
                  }}
                >
                  {item.userWord}
                </span>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <span>🟢 To&apos;g&apos;ri</span>
            <span>🟠 Deyarli to&apos;g&apos;ri</span>
            <span>🔴 Yetishmaydi</span>
            <span>⚪ Ortiqcha</span>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleRetry} className="btn-outline flex items-center gap-2">
            <RotateCcw size={15} /> {t('dictation.retry')}
          </button>
          {passed && (
            <button
              onClick={() => router.push('/listening/dictation')}
              className="btn-primary flex items-center gap-2"
            >
              {t('dictation.next')} <ChevronRight size={15} />
            </button>
          )}
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
