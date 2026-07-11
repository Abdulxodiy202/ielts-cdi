'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useReducer, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { Keyboard, RotateCcw, Settings } from 'lucide-react'

/* ── Config types ─────────────────────────────────────────────────── */
type Mode = 'time' | 'words'
type WordSetId = 'common_english' | 'ielts_vocabulary' | 'task1' | 'task2'
type PageStatus = 'config' | 'essaySelector' | 'typing' | 'result'

interface TypingEssayListItem {
  id: number
  title: string
  content: string
  word_count: number
}

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

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

/* ── Essay character sequence (Task 1 / Task 2 only) ─────────────────
   Unlike Common English / IELTS Vocabulary, essays type like TypingClub/
   edclub: the whole essay is ONE flat sequence of characters, where a
   paragraph break is a real '\n' token the user must actively press Enter
   for — not a visual-only divider and not something Space can skip past.
   Admins may write \n, \n\n, \n\n\n... between paragraphs; collapse any
   run down to a single \n so the user only ever has to press Enter once
   per gap, however many blank lines the admin left. This is a completely
   separate engine (see EssayState/essayReducer below) — Common English/
   IELTS Vocabulary keep using `words`/`typingReducer` exactly as before. ── */
function normalizeEssayContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function buildCharSequence(content: string): string[] {
  return normalizeEssayContent(content).split('')
}

/** Groups the flat character sequence into word / space / newline chunks so
    word characters can be wrapped in an inline-block whiteSpace:nowrap span
    at render time. Under `flex-wrap`, EVERY direct flex-item child is a
    wrap boundary -- if each character is its own top-level span, the
    browser will happily break mid-word (e.g. "ca" + "n" on next line).
    Grouping a word's characters into a single flex item forces the whole
    word to wrap as a unit. Kept as a separate helper (not baked into the
    render loop) so it can be memoized on chars.length -- the group
    structure only changes on RESET, not on every keystroke. */
type EssayGroup =
  | { type: 'word'; chars: { ch: string; index: number }[] }
  | { type: 'space'; index: number }
  | { type: 'newline'; index: number }

function groupIntoWords(charSequence: string[]): EssayGroup[] {
  const groups: EssayGroup[] = []
  let currentWord: { type: 'word'; chars: { ch: string; index: number }[] } | null = null
  charSequence.forEach((ch, index) => {
    if (ch === '\n') {
      if (currentWord) { groups.push(currentWord); currentWord = null }
      groups.push({ type: 'newline', index })
    } else if (ch === ' ') {
      if (currentWord) { groups.push(currentWord); currentWord = null }
      groups.push({ type: 'space', index })
    } else {
      if (!currentWord) currentWord = { type: 'word', chars: [] }
      currentWord.chars.push({ ch, index })
    }
  })
  if (currentWord) groups.push(currentWord)
  return groups
}

/* ── Typing engine (reducer) ──────────────────────────────────────── */
interface TypingState {
  words: string[]
  inputs: string[]
  currentIndex: number
  started: boolean
  finished: boolean
  endless: boolean // time mode: word buffer can grow, never "runs out"
  // Keystroke-level tallies: incremented once per keystroke as it happens
  // and never decremented by backspace, so accuracy reflects every mistake
  // made during the test — including ones the user later fixed — instead
  // of just diffing the final on-screen text against the target.
  correctKeystrokes: number
  incorrectKeystrokes: number
  extraKeystrokes: number
  missedChars: number
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
        correctKeystrokes: 0,
        incorrectKeystrokes: 0,
        extraKeystrokes: 0,
        missedChars: 0,
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
      const target = state.words[state.currentIndex] ?? ''
      // Position this keystroke lands at, BEFORE appending it — this is what
      // determines whether it's correct/incorrect/extra, and that judgment
      // is locked in permanently (backspace only edits `inputs`, never these
      // tallies), so a later fix doesn't erase the original mistake.
      const posInWord = (state.inputs[state.currentIndex] ?? '').length
      inputs[state.currentIndex] = (inputs[state.currentIndex] ?? '') + action.ch
      const lastWord = !state.endless && state.currentIndex === state.words.length - 1
      const finished = lastWord && inputs[state.currentIndex].length >= state.words[state.currentIndex].length
      const isExtra = posInWord >= target.length
      const isCorrect = !isExtra && action.ch === target[posInWord]
      return {
        ...state,
        inputs,
        started: true,
        finished,
        correctKeystrokes: state.correctKeystrokes + (isCorrect ? 1 : 0),
        incorrectKeystrokes: state.incorrectKeystrokes + (!isExtra && !isCorrect ? 1 : 0),
        extraKeystrokes: state.extraKeystrokes + (isExtra ? 1 : 0),
      }
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
      const target = state.words[state.currentIndex] ?? ''
      const typedLen = (state.inputs[state.currentIndex] ?? '').length
      const remaining = target.length - typedLen
      const missedChars = state.missedChars + (remaining > 0 ? remaining : 0)
      const atLastWord = state.currentIndex >= state.words.length - 1
      // In endless (time) mode there is no "last word" to freeze at — always
      // advance and trust the buffer-extend effect to keep words ahead of the
      // cursor. Freezing here (as before) could permanently strand the user
      // on the final word if the extend effect ever ran a beat late.
      if (atLastWord && !state.endless) {
        return { ...state, started: true, finished: true, missedChars }
      }
      return { ...state, currentIndex: state.currentIndex + 1, started: true, missedChars }
    }
    case 'FORCE_FINISH':
      return { ...state, finished: true }
    default:
      return state
  }
}

/* ── Essay engine (reducer) — separate from the word engine above. Every
   position in `chars` (letters, spaces, and '\n' paragraph breaks alike)
   takes exactly one keystroke: right key advances as correct, any other
   key advances as wrong. There is no "extra" (nothing to overtype past —
   the sequence has a fixed length) and no "missed" (the test only finishes
   once every position has been typed). ── */
interface EssayState {
  chars: string[]
  typedKeys: (string | null)[]
  currentIndex: number
  started: boolean
  finished: boolean
  correctKeystrokes: number    // all correct keystrokes incl. '\n' — used for accuracy
  incorrectKeystrokes: number  // all incorrect keystrokes incl. wrong-key-at-'\n' — used for accuracy
  correctNonNewlineKeystrokes: number // excludes '\n' — used for WPM only, per spec
}

type EssayAction =
  | { type: 'RESET'; chars: string[] }
  | { type: 'KEY'; key: string }
  | { type: 'BACKSPACE' }
  | { type: 'BACKSPACE_WORD' }

function essayReducer(state: EssayState, action: EssayAction): EssayState {
  switch (action.type) {
    case 'RESET':
      return {
        chars: action.chars,
        typedKeys: action.chars.map(() => null),
        currentIndex: 0,
        started: false,
        finished: false,
        correctKeystrokes: 0,
        incorrectKeystrokes: 0,
        correctNonNewlineKeystrokes: 0,
      }
    case 'KEY': {
      if (state.finished || state.currentIndex >= state.chars.length) return state
      const target = state.chars[state.currentIndex]
      const typedKeys = state.typedKeys.slice()
      typedKeys[state.currentIndex] = action.key
      const isCorrect = action.key === target
      const nextIndex = state.currentIndex + 1
      const finished = nextIndex >= state.chars.length
      return {
        ...state,
        typedKeys,
        currentIndex: nextIndex,
        started: true,
        finished,
        correctKeystrokes: state.correctKeystrokes + (isCorrect ? 1 : 0),
        incorrectKeystrokes: state.incorrectKeystrokes + (isCorrect ? 0 : 1),
        correctNonNewlineKeystrokes: state.correctNonNewlineKeystrokes + (isCorrect && target !== '\n' ? 1 : 0),
      }
    }
    case 'BACKSPACE': {
      if (state.finished || state.currentIndex === 0) return state
      const prevIndex = state.currentIndex - 1
      const typedKeys = state.typedKeys.slice()
      typedKeys[prevIndex] = null
      return { ...state, currentIndex: prevIndex, typedKeys }
    }
    case 'BACKSPACE_WORD': {
      // Ctrl/Cmd+Backspace: walk back through characters, resetting each
      // to untyped, until we hit (and clear) the trailing separator of the
      // previous word — a space or '\n'. Matches the standard "delete
      // whole previous word" behavior in text inputs and terminals.
      if (state.finished || state.currentIndex === 0) return state
      const typedKeys = state.typedKeys.slice()
      let idx = state.currentIndex
      while (idx > 0) {
        idx--
        typedKeys[idx] = null
        const ch = state.chars[idx]
        if (ch === ' ' || ch === '\n') break
      }
      return { ...state, currentIndex: idx, typedKeys }
    }
    default:
      return state
  }
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
  const [taskEssays, setTaskEssays] = useState<TypingEssayListItem[]>([])
  const [selectedEssay, setSelectedEssay] = useState<TypingEssayListItem | null>(null)
  const wordPoolRef = useRef<string[]>([])

  const [typingState, dispatch] = useReducer(typingReducer, {
    words: [], inputs: [], currentIndex: 0, started: false, finished: false, endless: false,
    correctKeystrokes: 0, incorrectKeystrokes: 0, extraKeystrokes: 0, missedChars: 0,
  })

  // Essay engine (Task 1 / Task 2 only) — a completely separate reducer so
  // Common English / IELTS Vocabulary never touch it and are unaffected.
  const [essayState, essayDispatch] = useReducer(essayReducer, {
    chars: [], typedKeys: [], currentIndex: 0, started: false, finished: false,
    correctKeystrokes: 0, incorrectKeystrokes: 0, correctNonNewlineKeystrokes: 0,
  })
  // Word/space/newline chunks for rendering — memoized because the group
  // structure only depends on the immutable `chars` array (fixed once per
  // RESET), not on which characters have been typed. Keeps render cheap
  // even for long essays.
  const essayGroups = useMemo(() => groupIntoWords(essayState.chars), [essayState.chars])
  // Total word count for the essay progress counter -- computed on the
  // normalized character sequence itself (splits on whitespace INCLUDING
  // '\n' the same way as Common English / IELTS Vocabulary counts words),
  // so it's guaranteed to match what a reader of the essay would count.
  const essayTotalWords = useMemo(() => {
    if (essayState.chars.length === 0) return 0
    return essayState.chars.join('').split(/\s+/).filter(Boolean).length
  }, [essayState.chars])
  // "Completed" words: words in chars[0..currentIndex) where the cursor
  // has moved PAST the word's last character. If the last typed char is
  // a separator (space/newline), the preceding word is complete. If the
  // cursor is mid-word (last typed char is a letter and we're not at the
  // end of the essay), the last word in the split isn't done yet, so
  // subtract 1. Once the essay is fully consumed, all words count.
  const essayTypedWords = useMemo(() => {
    const idx = essayState.currentIndex
    if (idx === 0) return 0
    const before = essayState.chars.slice(0, idx).join('')
    const words = before.split(/\s+/).filter(Boolean)
    const atEnd = idx >= essayState.chars.length
    const lastChar = before[before.length - 1]
    const midWord = !atEnd && lastChar !== undefined && lastChar !== ' ' && lastChar !== '\n'
    return midWord ? Math.max(0, words.length - 1) : words.length
  }, [essayState.chars, essayState.currentIndex])

  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())

  const inputRef = useRef<HTMLInputElement>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const charRefs = useRef<(HTMLSpanElement | null)[]>([])
  const linesWrapRef = useRef<HTMLDivElement>(null)
  const cursorAnchorRef = useRef<HTMLSpanElement>(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

  /* ── Visual-line grouping (independent of word index): which line each
     word actually wrapped onto, computed by measuring the DOM. Scrolling is
     driven by "which line is the cursor's line", not by re-deriving a line
     number from a possibly-mid-transition getBoundingClientRect() read. ── */
  const [lines, setLines] = useState<number[][]>([])
  const [topLineIndex, setTopLineIndex] = useState(0)
  const VISIBLE_LINES = 3

  /* ── Responsive type size, kept in sync between CSS and the JS scroll math ── */
  const [isMobile, setIsMobile] = useState(false)
  const [resizeTick, setResizeTick] = useState(0)
  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth <= 768); setResizeTick(t => t + 1) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const FONT_SIZE = isMobile ? 28 : 40
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.5)
  // Slightly shorter than the glyphs and vertically centered within the row
  // (LINE_HEIGHT), not top-aligned to it — the row is taller than the font
  // itself, so anchoring the cursor's top to the row's top left it sitting
  // above the letters instead of level with them.
  const CURSOR_HEIGHT = FONT_SIZE * 0.9
  const CURSOR_Y_OFFSET = (LINE_HEIGHT - CURSOR_HEIGHT) / 2

  /* ── Shared reset of the typing-engine UI state, used whenever a fresh
     set of words/an essay is about to be typed from scratch. ── */
  const resetTypingUiState = useCallback(() => {
    setStartedAt(null)
    setEndedAt(null)
    setTopLineIndex(0)
    setLines([])
    setCursorPos({ x: 0, y: 0 })
    wordRefs.current = []
    charRefs.current = []
    setStatus('typing')
  }, [])

  /* ── Fetch words for Common English / IELTS Vocabulary ───────────── */
  const loadTest = useCallback(async () => {
    setLoadingWords(true)
    setLoadError(null)
    setEssayTitle(null)
    try {
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
      resetTypingUiState()
    } finally {
      setLoadingWords(false)
    }
  }, [wordSet, mode, wordGoal, resetTypingUiState])

  /* ── Fetch the list of essays for Task 1 / Task 2, so the user can pick
     one instead of having a random one assigned. ── */
  const loadEssayList = useCallback(async () => {
    setLoadingWords(true)
    setLoadError(null)
    setSelectedEssay(null)
    try {
      const res = await fetch(`/api/typing/essays/${wordSet}`)
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setLoadError(e.error === 'no_essays_available' ? 'noEssays' : 'genericError')
        return
      }
      const data: { essays: TypingEssayListItem[] } = await res.json()
      setTaskEssays(data.essays)
      setStatus('essaySelector')
    } finally {
      setLoadingWords(false)
    }
  }, [wordSet])

  /** Loads one specific essay's content into the typing engine and starts
      the test — used both for the initial pick and for retrying the same
      essay (Tab / "Try Again" keep the current essay, not a new random one). */
  const startEssay = useCallback((essay: TypingEssayListItem) => {
    const chars = buildCharSequence(essay.content)
    // Diagnostic: dump exactly where '\n' lands in the normalized
    // sequence so a stray ↵ in the rendered output can be traced to
    // either (a) admin data actually containing a newline there or (b)
    // a tokenizer bug. The task's bug 2 report can be verified against
    // this: ↵ only appears where chars[i] === '\n'.
    const newlinePositions: number[] = []
    for (let i = 0; i < chars.length; i++) if (chars[i] === '\n') newlinePositions.push(i)
    const wordCount = chars.join('').split(/\s+/).filter(Boolean).length
    // eslint-disable-next-line no-console
    console.log('[typing] essay loaded:',
      { title: essay.title, chars: chars.length, words: wordCount, newlinePositions })
    setSelectedEssay(essay)
    setEssayTitle(essay.title)
    essayDispatch({ type: 'RESET', chars })
    resetTypingUiState()
  }, [resetTypingUiState])

  /** "Restart" (Tab / Try Again): reload the same essay for essay modes —
      never a new random one — or reshuffle the same word pool otherwise. */
  const restartCurrent = useCallback(() => {
    if (isEssaySet && selectedEssay) startEssay(selectedEssay)
    else loadTest()
  }, [isEssaySet, selectedEssay, startEssay, loadTest])

  /** "Config" (Escape / New Config): for essay modes there's no time/word
      config to show, so it goes back to the essay picker instead. */
  const goToConfigOrSelector = useCallback(() => {
    if (isEssaySet) setStatus('essaySelector')
    else setStatus('config')
  }, [isEssaySet])

  /* ── Extend the word buffer for time mode as the user approaches the end ── */
  useEffect(() => {
    if (!typingState.endless) return
    if (typingState.words.length - typingState.currentIndex <= 50 && wordPoolRef.current.length > 0) {
      const pool = wordPoolRef.current
      const batch: string[] = []
      while (batch.length < 100) batch.push(...shuffleNoAdjacentDupes(pool))
      dispatch({ type: 'EXTEND', words: batch.slice(0, 100) })
    }
  }, [typingState.endless, typingState.currentIndex, typingState.words.length])

  /* ── Start the clock on the first keystroke ──────────────────────── */
  useEffect(() => {
    const started = isEssaySet ? essayState.started : typingState.started
    if (started && startedAt === null) setStartedAt(Date.now())
  }, [isEssaySet, essayState.started, typingState.started, startedAt])

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
    const finished = isEssaySet ? essayState.finished : typingState.finished
    if (finished && endedAt === null) {
      setEndedAt(Date.now())
      setStatus('result')
    }
  }, [isEssaySet, essayState.finished, typingState.finished, endedAt])

  /* ── Group words into visual lines by measuring where the browser actually
     wrapped them (flex-wrap handles the wrapping; we just read it back).
     Recomputed whenever the word list grows (EXTEND), the layout could
     reflow (font-size/viewport change), OR the user overtypes a word with
     extra characters — that grows the word's rendered width and reflows
     every later word onto different lines, so `inputs` must be a dependency
     too or the cached line map silently desyncs from the real DOM the
     moment a typo happens (which is most tests). Never re-measures during
     the scroll itself, so it can't be thrown off by a mid-transition
     transform read. Word mode only — guarded so it doesn't clobber the
     essay engine's own line-grouping effect below while an essay is active. ── */
  useLayoutEffect(() => {
    if (isEssaySet) return
    const refs = wordRefs.current
    const newLines: number[][] = []
    let currentLine: number[] = []
    let lastTop: number | null = null
    for (let i = 0; i < typingState.words.length; i++) {
      const el = refs[i]
      if (!el) continue
      const top = el.getBoundingClientRect().top
      if (lastTop === null || Math.abs(top - lastTop) < 1) {
        currentLine.push(i)
      } else {
        if (currentLine.length > 0) newLines.push(currentLine)
        currentLine = [i]
      }
      lastTop = top
    }
    if (currentLine.length > 0) newLines.push(currentLine)
    setLines(newLines)
  }, [isEssaySet, typingState.words.length, typingState.inputs, FONT_SIZE, resizeTick])

  /* ── Same line-grouping, but for the essay engine's flat character
     sequence. A paragraph break ('\n') is followed by a break div that
     reserves one extra blank LINE_HEIGHT row (see the render below), so two
     consecutive characters can land TWO line-heights apart instead of one.
     Rounding the gap to the nearest multiple of LINE_HEIGHT and inserting
     that many line "slots" (an empty array for the blank row) keeps every
     index into `lines` meaning exactly what it always did: one LINE_HEIGHT
     of vertical space. Without this, a paragraph gap would silently vanish
     from the count and the scroll transform would undershoot by however
     many blank rows it skipped. ── */
  useLayoutEffect(() => {
    if (!isEssaySet) return
    const refs = charRefs.current
    const newLines: number[][] = []
    let currentLine: number[] = []
    let lastTop: number | null = null
    for (let i = 0; i < essayState.chars.length; i++) {
      const el = refs[i]
      if (!el) continue
      const top = el.getBoundingClientRect().top
      if (lastTop === null || Math.abs(top - lastTop) < 1) {
        currentLine.push(i)
      } else {
        if (currentLine.length > 0) newLines.push(currentLine)
        const linesSkipped = Math.max(1, Math.round((top - lastTop) / LINE_HEIGHT))
        for (let blank = 1; blank < linesSkipped; blank++) newLines.push([])
        currentLine = [i]
      }
      lastTop = top
    }
    if (currentLine.length > 0) newLines.push(currentLine)
    setLines(newLines)
  }, [isEssaySet, essayState.chars.length, essayState.typedKeys, FONT_SIZE, resizeTick, LINE_HEIGHT])

  /* ── Which visual line the cursor is currently on ── */
  const currentLineIndex = useMemo(() => {
    const idx = isEssaySet ? essayState.currentIndex : typingState.currentIndex
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(idx)) return i
    }
    return lines.length > 0 ? lines.length - 1 : 0
  }, [lines, isEssaySet, essayState.currentIndex, typingState.currentIndex])

  /* ── Keep the cursor's line pinned to the middle of the 3-line window once
     the user has moved past the very first line, so the visible window is
     always 1 finished line above + cursor's line + 1 upcoming line below.
     In word mode this only advances forward — typing tests essentially
     never backspace across a line, and keeping the pin monotonic there
     preserves the previously-verified "scroll exactly one line at a time"
     guarantee. In essay mode the user can hold Backspace / Ctrl+Backspace
     back through many lines, so the pin also REWINDS to keep the cursor
     on the middle line — otherwise the cursor would drop above the
     visible window (topLineIndex stuck too far forward) and the user
     would think Backspace stopped working. ── */
  useEffect(() => {
    if (currentLineIndex === 0) {
      if (isEssaySet && topLineIndex !== 0) setTopLineIndex(0)
      return
    }
    const desiredTopLine = currentLineIndex - 1
    if (isEssaySet) {
      if (desiredTopLine !== topLineIndex) setTopLineIndex(desiredTopLine)
    } else {
      if (desiredTopLine > topLineIndex) setTopLineIndex(desiredTopLine)
    }
  }, [currentLineIndex, topLineIndex, isEssaySet])

  /* ── Track the cursor's target position so it can animate smoothly via a
     CSS transform transition, instead of jumping as an inline element.
     Y is computed analytically from (currentLineIndex - topLineIndex) *
     LINE_HEIGHT rather than measured off the anchor's live DOM position.
     The lines container animates via its own CSS transition whenever
     topLineIndex changes (e.g. on every scroll, and on restart snapping
     back to 0), so a getBoundingClientRect() read taken shortly after is
     racing that transition — it can land mid-animation and capture a
     position partway between the old and new scroll offset. Computing Y
     from state sidesteps the race entirely. X is still DOM-measured since
     translateY never affects the horizontal axis, so it's unaffected by
     the transition's progress — which also means it no longer needs to
     wait a frame. This runs as a layout effect (not a passive effect
     deferred behind a requestAnimationFrame) so the very first paint of a
     fresh test already shows the corrected, offset position instead of
     briefly flashing the uncentered {0,0} reset value until the first
     keystroke happens to re-trigger the old rAF-based measurement.
     Word mode only — guarded so it doesn't fight the essay engine's own
     cursor-position effect below while an essay is active. ── */
  useLayoutEffect(() => {
    if (isEssaySet) return
    if (!cursorAnchorRef.current || !linesWrapRef.current) return
    const anchorRect = cursorAnchorRef.current.getBoundingClientRect()
    const wrapRect = linesWrapRef.current.getBoundingClientRect()
    setCursorPos({
      x: anchorRect.left - wrapRect.left,
      y: (currentLineIndex - topLineIndex) * LINE_HEIGHT + CURSOR_Y_OFFSET,
    })
  }, [isEssaySet, typingState.currentIndex, typingState.inputs[typingState.currentIndex], topLineIndex, currentLineIndex, LINE_HEIGHT, CURSOR_Y_OFFSET])

  /* ── Debug log for essay-mode cursor tracking. Fires on every cursor
     move so the console shows exactly which char index the state points
     at and what character is there — used to diagnose the earlier
     "cursor lands on the wrong character" report. The essay engine has
     no DOM-measurement cursor effect anymore; the visible cursor is a
     CSS ::before pseudo-element on the current char's span (see the
     .typing-essay-current class in the <style> block below), so it's
     structurally impossible for the cursor position to disagree with
     essayState.currentIndex the way an absolute-pixel-positioned overlay
     could when its measurements went stale. ── */
  useEffect(() => {
    if (!isEssaySet) return
    // eslint-disable-next-line no-console
    console.log('[typing] cursorIndex:', essayState.currentIndex,
      '| char at cursor:', JSON.stringify(essayState.chars[essayState.currentIndex]),
      '| prev char:', JSON.stringify(essayState.chars[essayState.currentIndex - 1]))
  }, [isEssaySet, essayState.currentIndex, essayState.chars])

  /* ── Keyboard handling ────────────────────────────────────────────── */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (status === 'result') {
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); restartCurrent(); return }
      if (e.key === 'Escape') { e.preventDefault(); goToConfigOrSelector(); return }
      return
    }
    if (status !== 'typing') return

    if (e.key === 'Tab') { e.preventDefault(); restartCurrent(); return }
    if (e.key === 'Escape') { e.preventDefault(); goToConfigOrSelector(); return }

    if (isEssaySet) {
      // Character-sequence engine: every position (letter, space, or '\n')
      // takes exactly one keystroke. Enter is only "correct" when the
      // cursor is on a '\n' position — the reducer's plain key===target
      // comparison already handles that (and the reverse: pressing Enter
      // where a letter was expected registers as wrong, same as any other
      // mismatched key), so there's no special-casing needed here beyond
      // mapping the Enter key to the '\n' token the sequence uses. Space
      // is dispatched as a normal key — it never skips/advances a "word"
      // the way it does in the word engine below, because there is no
      // word concept here at all.
      // Ctrl/Cmd+Backspace has to be checked BEFORE the modifier
      // early-return below, or it'd fall through as "browser shortcut".
      if (e.key === 'Backspace' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); essayDispatch({ type: 'BACKSPACE_WORD' }); return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Backspace') { e.preventDefault(); essayDispatch({ type: 'BACKSPACE' }); return }
      if (e.key === 'Enter') { e.preventDefault(); essayDispatch({ type: 'KEY', key: '\n' }); return }
      if (e.key.length === 1) { e.preventDefault(); essayDispatch({ type: 'KEY', key: e.key }) }
      return
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return // let browser shortcuts through

    if (e.key === 'Backspace') { e.preventDefault(); dispatch({ type: 'BACKSPACE' }); return }
    if (e.key === ' ') { e.preventDefault(); dispatch({ type: 'SPACE' }); return }
    if (e.key.length === 1) { e.preventDefault(); dispatch({ type: 'CHAR', ch: e.key }) }
  }, [status, restartCurrent, goToConfigOrSelector, isEssaySet])

  /* ── Auto-focus the capture input ─────────────────────────────────── */
  useEffect(() => {
    if (status === 'typing' || status === 'result') inputRef.current?.focus()
  }, [status])

  /* ── Stats for the result screen — every keystroke counts, including ones
     later fixed with backspace, so accuracy reflects mistakes actually made
     rather than just diffing the final text against the target. For essay
     mode, accuracy includes '\n' keystrokes (the user had to actively press
     Enter for them) but WPM's word count excludes them, per spec — there's
     no "extra"/"missed" concept in the essay engine (fixed-length sequence,
     always fully consumed), so those are just 0 there. ── */
  const correctKeystrokes = isEssaySet ? essayState.correctKeystrokes : typingState.correctKeystrokes
  const incorrectKeystrokes = isEssaySet ? essayState.incorrectKeystrokes : typingState.incorrectKeystrokes
  const extraKeystrokes = isEssaySet ? 0 : typingState.extraKeystrokes
  const missedChars = isEssaySet ? 0 : typingState.missedChars
  const correctForWpm = isEssaySet ? essayState.correctNonNewlineKeystrokes : typingState.correctKeystrokes
  const elapsedMinutes = startedAt && endedAt ? Math.max((endedAt - startedAt) / 60000, 1 / 600) : 0
  const wpm = elapsedMinutes > 0 ? Math.round((correctForWpm / 5) / elapsedMinutes) : 0
  const totalKeystrokes = correctKeystrokes + incorrectKeystrokes + extraKeystrokes
  const accuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 0
  const elapsedSeconds = startedAt && endedAt ? Math.round((endedAt - startedAt) / 1000) : 0

  /* ── Live counter (top-left) ──────────────────────────────────────── */
  const liveCounter = (() => {
    if (mode === 'time' && !isEssaySet) {
      if (startedAt === null) return String(duration)
      const remaining = Math.max(0, duration - Math.floor((nowTick - startedAt) / 1000))
      return String(remaining)
    }
    if (isEssaySet) {
      // Words progress, not characters -- matches the "N/M" the word
      // engine shows for Common English / IELTS Vocabulary.
      return `${essayTypedWords}/${essayTotalWords}`
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
        /* Essay-mode cursor: attach as a ::before pseudo to the current
           char span itself, so the cursor is always exactly on
           charSequence[currentIndex] regardless of wrap/scroll/resize --
           no getBoundingClientRect() measurement to go stale. */
        .typing-essay-current { position: relative; }
        .typing-essay-current::before {
          content: '';
          position: absolute;
          left: -1px;
          top: 5%;
          bottom: 5%;
          width: 2px;
          background: #e2b714;
          animation: typingCursorBlink 1s step-end infinite;
          pointer-events: none;
        }
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
            onClick={isEssaySet ? loadEssayList : loadTest}
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

      {status === 'essaySelector' && (
        <div className="w-full max-w-3xl flex flex-col items-center gap-6">
          <h2 className="text-lg font-bold" style={{ color: '#fff' }}>
            {t('typing.essaySelector.chooseEssay')}
          </h2>

          {taskEssays.length === 0 ? (
            <p className="text-sm text-center" style={{ color: '#f87171' }}>{t('typing.noEssays')}</p>
          ) : (
            <div className="grid gap-4 w-full sm:grid-cols-2 lg:grid-cols-3">
              {taskEssays.map(essay => (
                <button
                  key={essay.id}
                  onClick={() => startEssay(essay)}
                  className="text-left p-4 rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.99]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="font-medium text-sm mb-1" style={{ color: '#fff' }}>{essay.title}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {essay.word_count} {t('typing.essaySelector.words')}
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setStatus('config')}
            className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            <Settings size={14} /> {t('typing.essaySelector.back')}
          </button>
        </div>
      )}

      {status === 'typing' && (
        <div
          className="w-full flex flex-col items-center gap-6"
          style={{ maxWidth: 1600, margin: '0 auto', padding: '0 40px', boxSizing: 'border-box' }}
        >
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
                fontSize: FONT_SIZE, lineHeight: `${LINE_HEIGHT}px`, letterSpacing: '0.02em',
                transform: `translateY(-${topLineIndex * LINE_HEIGHT}px)`,
              }}
            >
              {isEssaySet ? essayGroups.map((g, gi) => {
                // Per-character span factory used by both the word-group
                // path and the standalone-space path. Each character still
                // gets its own charRefs slot so the cursor-position effect
                // and the essay line-grouping effect can measure it.
                const renderChar = (charStr: string, i: number) => {
                  const typedKey = essayState.typedKeys[i]
                  const isCurrent = i === essayState.currentIndex
                  const isDone = i < essayState.currentIndex
                  let color = 'rgba(255,255,255,0.35)'
                  let underline = false
                  if (typedKey !== null) {
                    const correct = typedKey === charStr
                    color = correct ? '#fff' : '#ca4754'
                    underline = !correct
                  }
                  return (
                    <span
                      key={i}
                      ref={el => { charRefs.current[i] = el }}
                      className={isCurrent ? 'typing-essay-current' : undefined}
                      style={{
                        color, textDecoration: underline ? 'underline' : 'none',
                        opacity: isDone || isCurrent ? 1 : 0.4,
                      }}
                    >
                      {charStr === ' ' ? ' ' : charStr}
                    </span>
                  )
                }

                if (g.type === 'word') {
                  // Whole-word wrap boundary: under `flex-wrap`, every
                  // direct child of the flex container is a wrap point --
                  // if each character is its own top-level flex item, the
                  // browser will happily break mid-word (e.g. "ca" + "n"
                  // on the next line). Grouping the word's characters
                  // into a single inline-block, whiteSpace: nowrap span
                  // makes them one flex item, so if the word doesn't fit
                  // on the current line the WHOLE word wraps. Chars
                  // inside stay `display: inline` (the default) so they
                  // still flow naturally within the word.
                  return (
                    <span key={`w-${gi}`} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                      {g.chars.map(({ ch, index }) => renderChar(ch, index))}
                    </span>
                  )
                }
                if (g.type === 'space') {
                  return renderChar(' ', g.index)
                }
                // g.type === 'newline'
                const i = g.index
                const typedKey = essayState.typedKeys[i]
                const isCurrent = i === essayState.currentIndex
                const isDone = i < essayState.currentIndex
                let color = 'rgba(255,255,255,0.35)'
                let underline = false
                if (typedKey !== null) {
                  const correct = typedKey === '\n'
                  color = correct ? '#fff' : '#ca4754'
                  underline = !correct
                }
                // Enter symbol: a real token the user must press Enter
                // for, same rules as any other character — just rendered
                // with the glyph edclub/TypingClub use for a paragraph
                // break instead of the literal character. Followed by a
                // width-100% break div that forces the next character
                // onto a fresh row (see the essay line-grouping effect
                // above for why the div's height must be exactly
                // LINE_HEIGHT, not an arbitrary value).
                const enterSpan = (
                  <span
                    key={i}
                    ref={el => { charRefs.current[i] = el }}
                    className={isCurrent ? 'typing-essay-current' : undefined}
                    style={{
                      display: 'inline-block',
                      opacity: isDone || isCurrent ? (underline ? 1 : 0.5) : 0.3,
                      fontSize: '0.9em', padding: '0 4px', color,
                      textDecoration: underline ? 'underline' : 'none',
                    }}
                  >
                    ↵
                  </span>
                )
                return (
                  <Fragment key={`f-${gi}`}>
                    {enterSpan}
                    {/* height:0 — the break forces the next character
                        onto a fresh visual line (via flexBasis: 100%)
                        without inserting a whole blank row of vertical
                        space. Previously this was height: LINE_HEIGHT,
                        which stacked an empty row between the ↵ line
                        and the next paragraph and made the cursor look
                        stuck in a blank middle row. Now the very next
                        visual line after the ↵ is the first line of the
                        next paragraph, edclub-style. */}
                    <div style={{ flexBasis: '100%', width: '100%', height: 0 }} />
                  </Fragment>
                )
              }) : typingState.words.map((word, i) => {
                const typed = typingState.inputs[i] ?? ''
                const isCurrent = i === typingState.currentIndex
                const isDone = i < typingState.currentIndex
                const len = Math.max(word.length, typed.length)
                // Invisible, zero-width position marker — measured (not
                // rendered as the visible cursor) so the real cursor can be
                // absolutely positioned and animate smoothly between spots
                // instead of jumping as an inline element would.
                // vertical-align: text-top matters here — a zero-height
                // inline-block defaults to baseline alignment, which sits
                // near the BOTTOM of the glyphs, not the top. Measuring from
                // baseline and extending the cursor downward by font-size
                // put almost the whole cursor bar below the visible letters
                // (and often clipped by the container's overflow:hidden).
                const anchor = (
                  <span
                    key="anchor"
                    ref={cursorAnchorRef}
                    style={{ display: 'inline-block', width: 0, verticalAlign: 'text-top' }}
                  />
                )
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
                    ref={el => { wordRefs.current[i] = el }}
                    style={{ opacity: isDone || isCurrent ? 1 : 0.4, marginRight: '0.5em' }}
                  >
                    {chars}
                  </span>
                )
              })}
            </div>

            {/* Smoothly-animated cursor, positioned via the measured anchor above.
                Word mode only -- essay mode uses a CSS ::before pseudo-element
                attached directly to the current char (see the <style> block up
                top), which can't desync from wrap/scroll/resize the way a
                measured absolute position can. */}
            {!isEssaySet && (
              <div
                style={{
                  position: 'absolute', top: 0, left: 0, width: 3, height: CURSOR_HEIGHT,
                  background: '#e2b714', pointerEvents: 'none',
                  transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)`,
                  transition: 'transform 0.1s ease-out',
                  animation: 'typingCursorBlink 1s step-end infinite',
                }}
              />
            )}
          </div>

          <div className="flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span>tab {t('typing.restartHint')}</span>
            <span>esc {t('typing.configHint')}</span>
          </div>
        </div>
      )}

      {status === 'result' && (
        <div className="w-full max-w-xl flex flex-col items-center gap-8">
          <div className="flex items-center justify-center flex-wrap gap-10">
            <div className="text-center">
              <div className="text-6xl font-black" style={{ color: '#a5b4fc' }}>{wpm}</div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>WPM</div>
            </div>
            <div className="text-center">
              <div className="text-6xl font-black" style={{ color: '#6ee7b7' }}>{accuracy}%</div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('typing.accuracy')}</div>
            </div>
            <div className="text-center">
              <div className="text-6xl font-black" style={{ color: '#fbbf24' }}>{formatTime(elapsedSeconds)}</div>
              <div className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('typing.time')}</div>
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('typing.characters')}</div>
            <div className="text-xl font-mono font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {correctKeystrokes} / {incorrectKeystrokes} / {extraKeystrokes} / {missedChars}
            </div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {t('typing.correct')} / {t('typing.incorrect')} / {t('typing.extra')} / {t('typing.missed')}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={restartCurrent}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm"
              style={{ background: '#6366f1', color: '#fff' }}
            >
              <RotateCcw size={14} /> {t('typing.tryAgain')} <span style={{ opacity: 0.6 }}>(tab)</span>
            </button>
            <button
              onClick={goToConfigOrSelector}
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
