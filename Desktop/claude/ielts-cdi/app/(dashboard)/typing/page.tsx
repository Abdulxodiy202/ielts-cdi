'use client'

import { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { Keyboard, RotateCcw, Settings } from 'lucide-react'

/* ── Config types ─────────────────────────────────────────────────── */
type Mode = 'time' | 'words'
type WordSetId = 'common_english' | 'ielts_vocabulary' | 'task1' | 'task2'
type PageStatus = 'config' | 'typing' | 'result'

const TIME_OPTIONS = [15, 30, 60, 120] as const
const WORD_OPTIONS = [25, 50, 100, 200] as const

const WORD_SET_LABELS: Record<WordSetId, string> = {
  common_english: 'Common English',
  ielts_vocabulary: 'IELTS Vocabulary',
  task1: 'Writing Task 1',
  task2: 'Writing Task 2',
}

/* ── Word shuffling helpers ───────────────────────────────────────── */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Shuffle, then swap any adjacent duplicate words so the same word never repeats back to back. */
function shuffleNoAdjacentDupes(words: string[]): string[] {
  const a = shuffle(words)
  for (let i = 1; i < a.length; i++) {
    if (a[i] === a[i - 1]) {
      const swapWith = a.findIndex((w, idx) => idx > i && w !== a[i - 1] && w !== a[i])
      if (swapWith !== -1) {
        ;[a[i], a[swapWith]] = [a[swapWith], a[i]]
      }
    }
  }
  return a
}

/* ── Typing engine (reducer) ──────────────────────────────────────── */
interface TypingState {
  words: string[]
  inputs: string[]
  currentIndex: number
  started: boolean
  finished: boolean
  endless: boolean // time mode: word buffer can grow, never "runs out"
}

type TypingAction =
  | { type: 'RESET'; words: string[]; endless: boolean }
  | { type: 'EXTEND'; words: string[] }
  | { type: 'CHAR'; ch: string }
  | { type: 'BACKSPACE' }
  | { type: 'SPACE' }
  | { type: 'FORCE_FINISH' }

function typingReducer(state: TypingState, action: TypingAction): TypingState {
  switch (action.type) {
    case 'RESET':
      return {
        words: action.words,
        inputs: action.words.map(() => ''),
        currentIndex: 0,
        started: false,
        finished: false,
        endless: action.endless,
      }
    case 'EXTEND':
      return {
        ...state,
        words: [...state.words, ...action.words],
        inputs: [...state.inputs, ...action.words.map(() => '')],
      }
    case 'CHAR': {
      if (state.finished) return state
      const inputs = state.inputs.slice()
      inputs[state.currentIndex] = (inputs[state.currentIndex] ?? '') + action.ch
      const lastWord = !state.endless && state.currentIndex === state.words.length - 1
      const finished = lastWord && inputs[state.currentIndex].length >= state.words[state.currentIndex].length
      return { ...state, inputs, started: true, finished }
    }
    case 'BACKSPACE': {
      if (state.finished) return state
      const inputs = state.inputs.slice()
      if ((inputs[state.currentIndex] ?? '').length > 0) {
        inputs[state.currentIndex] = inputs[state.currentIndex].slice(0, -1)
        return { ...state, inputs }
      }
      if (state.currentIndex > 0) {
        return { ...state, currentIndex: state.currentIndex - 1 }
      }
      return state
    }
    case 'SPACE': {
      if (state.finished || (state.inputs[state.currentIndex] ?? '').length === 0) return state
      const atLastWord = state.currentIndex >= state.words.length - 1
      // In endless (time) mode there is no "last word" to freeze at — always
      // advance and trust the buffer-extend effect to keep words ahead of the
      // cursor. Freezing here (as before) could permanently strand the user
      // on the final word if the extend effect ever ran a beat late.
      if (atLastWord && !state.endless) {
        return { ...state, started: true, finished: true }
      }
      return { ...state, currentIndex: state.currentIndex + 1, started: true }
    }
    case 'FORCE_FINISH':
      return { ...state, finished: true }
    default:
      return state
  }
}

interface Stats {
  correct: number
  incorrect: number
  extra: number
  missed: number
}

function computeStats(words: string[], inputs: string[], upToIndex: number): Stats {
  const stats: Stats = { correct: 0, incorrect: 0, extra: 0, missed: 0 }
  for (let i = 0; i <= upToIndex && i < words.length; i++) {
    const target = words[i] ?? ''
    const typed = inputs[i] ?? ''
    const len = Math.max(target.length, typed.length)
    for (let j = 0; j < len; j++) {
      if (j < target.length && j < typed.length) {
        if (typed[j] === target[j]) stats.correct++
        else stats.incorrect++
      } else if (j >= target.length) {
        stats.extra++
      } else {
        stats.missed++
      }
    }
  }
  return stats
}

/* ── Component ────────────────────────────────────────────────────── */
export default function TypingPage() {
  const router = useRouter()
  const { t } = useLanguage()

  const [authChecked, setAuthChecked] = useState(false)
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setAuthChecked(true)
    })
  }, [router])

  const [status, setStatus] = useState<PageStatus>('config')
  const [mode, setMode] = useState<Mode>('time')
  const [duration, setDuration] = useState<number>(30)
  const [wordGoal, setWordGoal] = useState<number>(25)
  const [wordSet, setWordSet] = useState<WordSetId>('common_english')
  const isEssaySet = wordSet === 'task1' || wordSet === 'task2'

  const [loadingWords, setLoadingWords] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [essayTitle, setEssayTitle] = useState<string | null>(null)
  const wordPoolRef = useRef<string[]>([])

  const [typingState, dispatch] = useReducer(typingReducer, {
    words: [], inputs: [], currentIndex: 0, started: false, finished: false, endless: false,
  })

  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())

  const inputRef = useRef<HTMLInputElement>(null)
  const currentWordRef = useRef<HTMLSpanElement>(null)
  const linesWrapRef = useRef<HTMLDivElement>(null)
  const cursorAnchorRef = useRef<HTMLSpanElement>(null)
  const [scrollLines, setScrollLines] = useState(0)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

  /* ── Responsive type size, kept in sync between CSS and the JS scroll math ── */
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const FONT_SIZE = isMobile ? 28 : 40
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.5)
  const VISIBLE_LINES = 4

  /* ── Fetch words/essay for the selected config ─────────────────── */
  const loadTest = useCallback(async () => {
    setLoadingWords(true)
    setLoadError(null)
    setEssayTitle(null)
    try {
      if (isEssaySet) {
        const res = await fetch(`/api/typing/essays/${wordSet}`)
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          setLoadError(e.error === 'no_essays_available' ? 'noEssays' : 'genericError')
          setLoadingWords(false)
          return
        }
        const data: { title: string; content: string } = await res.json()
        const essayWords = data.content.trim().split(/\s+/).filter(Boolean)
        setEssayTitle(data.title)
        wordPoolRef.current = []
        dispatch({ type: 'RESET', words: essayWords, endless: false })
      } else {
        const res = await fetch(`/api/typing/words/${wordSet}`)
        const data: { words?: string[] } = res.ok ? await res.json() : {}
        const pool = data.words && data.words.length > 0 ? data.words : []
        if (pool.length === 0) {
          setLoadError('genericError')
          setLoadingWords(false)
          return
        }
        wordPoolRef.current = pool
        if (mode === 'time') {
          const initial = [...shuffleNoAdjacentDupes(pool), ...shuffleNoAdjacentDupes(pool)]
          dispatch({ type: 'RESET', words: initial, endless: true })
        } else {
          const list: string[] = []
          while (list.length < wordGoal) list.push(...shuffleNoAdjacentDupes(pool))
          dispatch({ type: 'RESET', words: list.slice(0, wordGoal), endless: false })
        }
      }
      setStartedAt(null)
      setEndedAt(null)
      setScrollLines(0)
      setStatus('typing')
    } finally {
      setLoadingWords(false)
    }
  }, [wordSet, mode, wordGoal, isEssaySet])

  /* ── Extend the word buffer for time mode as the user approaches the end ── */
  useEffect(() => {
    if (!typingState.endless) return
    if (typingState.words.length - typingState.currentIndex <= 20 && wordPoolRef.current.length > 0) {
      const pool = wordPoolRef.current
      const batch: string[] = []
      while (batch.length < 100) batch.push(...shuffleNoAdjacentDupes(pool))
      dispatch({ type: 'EXTEND', words: batch.slice(0, 100) })
    }
  }, [typingState.endless, typingState.currentIndex, typingState.words.length])

  /* ── Start the clock on the first keystroke ──────────────────────── */
  useEffect(() => {
    if (typingState.started && startedAt === null) setStartedAt(Date.now())
  }, [typingState.started, startedAt])

  /* ── Ticking clock (drives the countdown + the timeout finish) ────── */
  useEffect(() => {
    if (status !== 'typing' || startedAt === null || endedAt !== null) return
    const id = setInterval(() => {
      setNowTick(Date.now())
      if (mode === 'time' && !isEssaySet) {
        const elapsed = (Date.now() - startedAt) / 1000
        if (elapsed >= duration) dispatch({ type: 'FORCE_FINISH' })
      }
    }, 200)
    return () => clearInterval(id)
  }, [status, startedAt, endedAt, mode, duration, isEssaySet])

  /* ── When the reducer marks the test finished, snapshot the end time ── */
  useEffect(() => {
    if (typingState.finished && endedAt === null) {
      setEndedAt(Date.now())
      setStatus('result')
    }
  }, [typingState.finished, endedAt])

  /* ── Auto-scroll the word lines: current line is pinned to the top, always
     leaving VISIBLE_LINES-1 (3) untyped lines visible ahead ── */
  useEffect(() => {
    if (!currentWordRef.current || !linesWrapRef.current) return
    const wrapTop = linesWrapRef.current.getBoundingClientRect().top
    const wordTop = currentWordRef.current.getBoundingClientRect().top
    const relativeLine = Math.round((wordTop - wrapTop) / LINE_HEIGHT) + scrollLines
    if (relativeLine > scrollLines) {
      setScrollLines(relativeLine)
    }
  }, [typingState.currentIndex, scrollLines, LINE_HEIGHT])

  /* ── Track the cursor's target position so it can animate smoothly via a
     CSS transform transition, instead of jumping as an inline element ── */
  useEffect(() => {
    if (!cursorAnchorRef.current || !linesWrapRef.current) return
    const anchorRect = cursorAnchorRef.current.getBoundingClientRect()
    const wrapRect = linesWrapRef.current.getBoundingClientRect()
    setCursorPos({ x: anchorRect.left - wrapRect.left, y: anchorRect.top - wrapRect.top })
  }, [typingState.currentIndex, typingState.inputs[typingState.currentIndex], scrollLines])

  /* ── Keyboard handling ────────────────────────────────────────────── */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (status === 'result') {
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); loadTest(); return }
      if (e.key === 'Escape') { e.preventDefault(); setStatus('config'); return }
      return
    }
    if (status !== 'typing') return

    if (e.key === 'Tab') { e.preventDefault(); loadTest(); return }
    if (e.key === 'Escape') { e.preventDefault(); setStatus('config'); return }
    if (e.ctrlKey || e.metaKey || e.altKey) return // let browser shortcuts through
    if (e.key === 'Backspace') { e.preventDefault(); dispatch({ type: 'BACKSPACE' }); return }
    if (e.key === ' ') { e.preventDefault(); dispatch({ type: 'SPACE' }); return }
    if (e.key.length === 1) { e.preventDefault(); dispatch({ type: 'CHAR', ch: e.key }) }
  }, [status, loadTest])

  /* ── Auto-focus the capture input ─────────────────────────────────── */
  useEffect(() => {
    if (status === 'typing' || status === 'result') inputRef.current?.focus()
  }, [status])

  /* ── Stats for the result screen ──────────────────────────────────── */
  const stats = useMemo(
    () => computeStats(typingState.words, typingState.inputs, typingState.currentIndex),
    [typingState.words, typingState.inputs, typingState.currentIndex],
  )
  const elapsedMinutes = startedAt && endedAt ? Math.max((endedAt - startedAt) / 60000, 1 / 600) : 0
  const wpm = elapsedMinutes > 0 ? Math.round((stats.correct / 5) / elapsedMinutes) : 0
  const totalTyped = stats.correct + stats.incorrect + stats.extra
  const accuracy = totalTyped > 0 ? Math.round((stats.correct / totalTyped) * 100) : 0

  /* ── Live counter (top-left) ──────────────────────────────────────── */
  const liveCounter = (() => {
    if (mode === 'time' && !isEssaySet) {
      if (startedAt === null) return String(duration)
      const remaining = Math.max(0, duration - Math.floor((nowTick - startedAt) / 1000))
      return String(remaining)
    }
    const current = Math.min(typingState.currentIndex + 1, typingState.words.length)
    return `${current}/${typingState.words.length}`
  })()

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-10"
      style={{ background: '#0a0a12', fontFamily: status === 'config' ? undefined : "'JetBrains Mono','Fira Code',monospace" }}
      onClick={() => inputRef.current?.focus()}
    >
      <style>{`
        @keyframes typingCursorBlink { 0%,49% { opacity:1 } 50%,100% { opacity:0 } }
      `}</style>

      {/* Hidden/minimal capture input — always focused; visible+tappable on mobile */}
      <input
        ref={inputRef}
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="fixed bottom-3 left-1/2 -translate-x-1/2 sm:opacity-0 sm:pointer-events-none text-center text-sm rounded-full px-4 py-2 outline-none"
        style={{ width: 220, zIndex: 40, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
        placeholder={t('typing.tapToType')}
      />

      {/* Logo */}
      <div className="flex items-center gap-2 mb-8 mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <Keyboard size={20} />
        <span className="font-bold text-sm" style={{ letterSpacing: '-.2px' }}>{t('typing.title')}</span>
      </div>

      {status === 'config' && (
        <div className="w-full max-w-3xl flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4 w-full">
            {/* Mode selector */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {(['time', 'words'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={isEssaySet}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-30"
                  style={{
                    background: mode === m && !isEssaySet ? 'rgba(99,102,241,0.18)' : 'transparent',
                    color: mode === m && !isEssaySet ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {m}
                </button>
              ))}
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
              {mode === 'time' ? (
                TIME_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setDuration(s)}
                    disabled={isEssaySet}
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-30"
                    style={{
                      background: duration === s && !isEssaySet ? 'rgba(99,102,241,0.18)' : 'transparent',
                      color: duration === s && !isEssaySet ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {s}s
                  </button>
                ))
              ) : (
                WORD_OPTIONS.map(w => (
                  <button
                    key={w}
                    onClick={() => setWordGoal(w)}
                    disabled={isEssaySet}
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-all disabled:opacity-30"
                    style={{
                      background: wordGoal === w && !isEssaySet ? 'rgba(99,102,241,0.18)' : 'transparent',
                      color: wordGoal === w && !isEssaySet ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {w}
                  </button>
                ))
              )}
            </div>

            {/* Word set selector */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {(Object.keys(WORD_SET_LABELS) as WordSetId[]).map(ws => (
                <button
                  key={ws}
                  onClick={() => setWordSet(ws)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: wordSet === ws ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    color: wordSet === ws ? '#6ee7b7' : 'rgba(255,255,255,0.5)',
                    border: '1px solid ' + (wordSet === ws ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'),
                  }}
                >
                  {t(`typing.wordSet.${ws}`)}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={loadTest}
            disabled={loadingWords}
            className="px-8 py-3 rounded-full font-bold text-base transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#6366f1', color: '#fff' }}
          >
            {loadingWords ? t('common.loading') : t('typing.startBtn')}
          </button>

          {loadError && (
            <p className="text-sm text-center" style={{ color: '#f87171' }}>
              {loadError === 'noEssays' ? t('typing.noEssays') : t('typing.loadError')}
            </p>
          )}
        </div>
      )}

      {status === 'typing' && (
        <div className="w-full max-w-4xl flex flex-col items-center gap-6">
          {essayTitle && (
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>{essayTitle}</p>
          )}
          <div className="text-2xl font-bold" style={{ color: '#a5b4fc' }}>{liveCounter}</div>

          <div
            ref={linesWrapRef}
            className="w-full overflow-hidden relative"
            style={{ height: LINE_HEIGHT * VISIBLE_LINES, cursor: 'text' }}
            onClick={() => inputRef.current?.focus()}
          >
            <div
              className="flex flex-wrap content-start transition-transform duration-200"
              style={{
                fontSize: FONT_SIZE, lineHeight: 1.5, letterSpacing: '0.02em',
                rowGap: '0.3em',
                transform: `translateY(-${scrollLines * LINE_HEIGHT}px)`,
              }}
            >
              {typingState.words.map((word, i) => {
                const typed = typingState.inputs[i] ?? ''
                const isCurrent = i === typingState.currentIndex
                const isDone = i < typingState.currentIndex
                const len = Math.max(word.length, typed.length)
                // Invisible, zero-width position marker — measured (not
                // rendered as the visible cursor) so the real cursor can be
                // absolutely positioned and animate smoothly between spots
                // instead of jumping as an inline element would.
                const anchor = <span key="anchor" ref={cursorAnchorRef} style={{ display: 'inline-block', width: 0 }} />
                const chars = []
                for (let j = 0; j < len; j++) {
                  if (isCurrent && j === typed.length) chars.push(anchor)

                  const targetCh = word[j]
                  const typedCh = typed[j]
                  let color = 'rgba(255,255,255,0.35)'
                  let underline = false
                  if (typedCh !== undefined && targetCh !== undefined) {
                    color = typedCh === targetCh ? '#fff' : '#ca4754'
                    underline = typedCh !== targetCh
                  } else if (typedCh !== undefined && targetCh === undefined) {
                    color = '#ca4754' // extra char
                  } else if (typedCh === undefined && targetCh !== undefined && isDone) {
                    color = 'rgba(255,255,255,0.35)' // missed char (word already passed)
                    underline = true
                  }
                  chars.push(
                    <span key={j} style={{ color, textDecoration: underline ? 'underline' : 'none' }}>
                      {targetCh ?? typedCh}
                    </span>,
                  )
                }
                // Anchor at the very end: word typed exactly in full, or past
                // the end with extra characters already appended.
                if (isCurrent && typed.length === len) chars.push(anchor)

                return (
                  <span
                    key={i}
                    ref={isCurrent ? currentWordRef : undefined}
                    style={{ opacity: isDone || isCurrent ? 1 : 0.4, marginRight: '0.5em' }}
                  >
                    {chars}
                  </span>
                )
              })}
            </div>

            {/* Smoothly-animated cursor, positioned via the measured anchor above */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0, width: 3, height: FONT_SIZE,
                background: '#e2b714', pointerEvents: 'none',
                transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)`,
                transition: 'transform 0.1s ease-out',
                animation: 'typingCursorBlink 1s step-end infinite',
              }}
            />
          </div>

          <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span>tab {t('typing.restartHint')}</span>
            <span>esc {t('typing.configHint')}</span>
          </div>
        </div>
      )}

      {status === 'result' && (
        <div className="w-full max-w-xl flex flex-col items-center gap-8">
          <div className="flex items-center gap-16">
            <div className="text-center">
              <div className="text-6xl font-black" style={{ color: '#a5b4fc' }}>{wpm}</div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>WPM</div>
            </div>
            <div className="text-center">
              <div className="text-6xl font-black" style={{ color: '#6ee7b7' }}>{accuracy}%</div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('typing.accuracy')}</div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('typing.characters')}</div>
            <div className="text-xl font-mono font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {stats.correct} / {stats.incorrect} / {stats.extra} / {stats.missed}
            </div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('typing.correct')} / {t('typing.incorrect')} / {t('typing.extra')} / {t('typing.missed')}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadTest}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm"
              style={{ background: '#6366f1', color: '#fff' }}
            >
              <RotateCcw size={14} /> {t('typing.tryAgain')} <span style={{ opacity: 0.6 }}>(tab)</span>
            </button>
            <button
              onClick={() => setStatus('config')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
            >
              <Settings size={14} /> {t('typing.newConfig')} <span style={{ opacity: 0.6 }}>(esc)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
