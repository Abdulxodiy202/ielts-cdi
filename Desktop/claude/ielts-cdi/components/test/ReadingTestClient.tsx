'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Save, Send, AlertTriangle, ArrowLeft, Trophy, CheckCircle, XCircle, BarChart2, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TestTimer } from './TestTimer'
import { QuestionPanel } from './QuestionPanel'
import { useTest } from '@/lib/hooks/useTest'
import { getBandColor, getBandLabel } from '@/lib/utils/bandScore'
import { formatTime } from '@/lib/utils/formatters'
import { buildInjectScript } from '@/lib/utils/injectScript'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { StarsBadge } from '@/components/ui/StarsBadge'
import { calcStarsFromBand } from '@/lib/stars'

interface Passage {
  id: string
  passage_number: number
  title: string
  content: string
}

interface Question {
  id: string
  question_number: number
  question_text: string
  question_type: string
  options: string[] | null
  passage_id: string | null
}

interface ReadingTestClientProps {
  test: { id: string; title: string; type: 'reading' | 'listening'; fileUrl?: string | null }
  passages: Passage[]
  questions: Question[]
  session: { id: string; time_remaining: number }
  userId: string
}


export function ReadingTestClient({ test, passages, questions, session }: ReadingTestClientProps) {
  const { t } = useLanguage()
  const [activePassage, setActivePassage] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [result, setResult] = useState<{ rawScore: number; bandScore: number; stars?: number; timeTaken: number } | null>(null)
  const [cdiSaveError, setCdiSaveError] = useState(false)
  const [showExit, setShowExit] = useState(false)
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const submittedRef = useRef(false)
  const nativeSubmitRef = useRef(false)
  const startTimeRef = useRef<number>(Date.now())
  const router = useRouter()

  const fileUrl = test.fileUrl ?? null
  const ext = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const isHtmlFile = ext === 'html' || ext === 'htm'
  const exitHref = `/${test.type ?? 'reading'}`

  /* ── Build blob URL (inject script for HTML, direct src for others) ── */
  useEffect(() => {
    if (!fileUrl) return
    if (!isHtmlFile) { setIframeSrc(fileUrl); return }

    let cancelled = false
    fetch(fileUrl)
      .then(r => r.text())
      .then(html => {
        if (cancelled) return
        const inject = buildInjectScript()
        const modified = /<\/body>/i.test(html)
          ? html.replace(/<\/body>/i, inject + '</body>')
          : html + inject
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const blob = new Blob([modified], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setIframeSrc(url)
      })
      .catch(() => { if (!cancelled) setIframeSrc(fileUrl) })
    return () => { cancelled = true }
  }, [fileUrl, isHtmlFile])

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  /* ── Listen for postMessage events from HTML iframe ── */
  useEffect(() => {
    if (!isHtmlFile) return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'CDI_NATIVE') {
        nativeSubmitRef.current = true
        setShowExit(true)
        return
      }
      if (e.data?.type === 'CDI_TRANSLATE') {
        const word = e.data.word
        console.log('[CDI_TRANSLATE] word received:', word)
        if (!word) return
        console.log('[CDI_TRANSLATE] fetching /api/translate...')
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word })
        })
          .then(r => { console.log('[CDI_TRANSLATE] response status:', r.status); return r.json() })
          .then(data => {
            console.log('[CDI_TRANSLATE] result:', data)
            const iframe = document.querySelector('iframe') as HTMLIFrameElement
            iframe?.contentWindow?.postMessage({
              type: 'CDI_TRANSLATE_RESULT',
              word,
              uzb: data.uzb || '',
              extra: data.extra || ''
            }, '*')
          })
          .catch(err => console.error('[CDI_TRANSLATE] error:', err))
        return
      }
      if (e.data?.type === 'CDI_GO_DASHBOARD') {
        router.push('/dashboard')
        return
      }
      // Only accept CDI_SUBMIT from the HTML file itself (flagged by CDI_NATIVE)
      if (e.data?.type === 'CDI_SUBMIT') {
        console.log('[CDI_SUBMIT] received, nativeRef:', nativeSubmitRef.current, 'submittedRef:', submittedRef.current, 'score:', e.data?.score)
        if (!nativeSubmitRef.current) return
        if (submittedRef.current) return
        submittedRef.current = true
        const score = typeof e.data.score === 'number' ? e.data.score : 0
        const answers = e.data.answers || null
        // Prefer HTML's own timer (3600 - timeInSeconds); fall back to wall clock
        const timeTaken = typeof e.data.timeTaken === 'number' && e.data.timeTaken > 0
          ? e.data.timeTaken
          : Math.round((Date.now() - startTimeRef.current) / 1000)
        fetch('/api/results/cdi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, testId: test.id, score, timeTaken, answers }),
        }).then(r => { if (!r.ok) setCdiSaveError(true) }).catch(() => setCdiSaveError(true))
        setShowExit(true)
        return
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [isHtmlFile, session.id, test.id])

  // Hook must always be called — pass noop for HTML (HTML manages its own timer)
  const { timeRemaining, answers, saving, saveAnswer } = useTest({
    sessionId: session.id,
    testId: test.id,
    initialTimeRemaining: session.time_remaining,
    onTimeUp: isHtmlFile ? () => {} : handleSubmit,
  })

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    const res = await fetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, testId: test.id, timeRemaining }),
    })
    const data = await res.json()
    if (res.ok) setResult(data)
    setSubmitting(false)
    setConfirmSubmit(false)
  }

  const answeredCount = Object.keys(answers).length

  /* ══════════════════════════════════════════════════════════════════
     HTML FILE MODE — pure full-screen iframe, no header bar at all
  ══════════════════════════════════════════════════════════════════ */
  if (isHtmlFile) {
    return (
      <>
        {iframeSrc ? (
          <iframe
            src={iframeSrc}
            title={test.title}
            style={{
              position: 'fixed',
              top: 0, left: 0,
              width: '100vw', height: '100vh',
              border: 'none', margin: 0, padding: 0,
              display: 'block', zIndex: 100,
            }}
          />
        ) : (
          <div style={{
            position: 'fixed', top: 0, left: 0,
            width: '100vw', height: '100vh', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-primary)',
          }}>
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">📄</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('common.loading')}</p>
            </div>
          </div>
        )}

        {/* Exit Test button — shown only after CDI_SUBMIT (Check Answers clicked) */}
        {showExit && (
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              zIndex: 99999,
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '15px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            ← {t('testTaking.exit')}
          </button>
        )}
      </>
    )
  }

  /* ══════════════════════════════════════════════════════════════════
     RESULT SCREEN — for non-HTML tests after submission
  ══════════════════════════════════════════════════════════════════ */
  if (result) {
    const color = getBandColor(result.bandScore)
    const label = getBandLabel(result.bandScore)
    const percentage = Math.round((result.rawScore / questions.length) * 100)
    // API returns `stars`, but fall back to a local calc so a schema-
    // less DB still renders correctly during rollout.
    const stars = result.stars ?? calcStarsFromBand(result.bandScore)

    return (
      <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="flex items-center justify-between px-4 py-3 gap-4"
          style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link href={exitHref} className="btn-outline text-sm flex items-center gap-1.5 shrink-0">
              <ArrowLeft size={14} /> <span>{t('testTaking.exit')}</span>
            </Link>
            <h1 className="font-bold text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)' }}>
              {test.title}
            </h1>
          </div>
          <Link href="/results" className="btn-primary text-sm flex items-center gap-1.5 shrink-0">
            <BarChart2 size={14} />
            <span className="hidden sm:inline">{t('results.title')}</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <motion.div
            className="card p-8 max-w-md w-full text-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          >
            <motion.div className="mb-6" initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}>
              <Trophy size={52} className="mx-auto mb-4" style={{ color }} />
              <div className="text-7xl font-black mb-1" style={{ color }}>{result.bandScore}</div>
              <div className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                {t('testTaking.bandScoreLabel', { label })}
              </div>
              <div className="mt-3 flex justify-center">
                <StarsBadge stars={stars} size={28} variant="inline" />
              </div>
            </motion.div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('testTaking.correct')}</span>
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>{result.rawScore}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle size={14} style={{ color: 'var(--error)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('testTaking.wrong')}</span>
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--error)' }}>
                  {questions.length - result.rawScore}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{t('testTaking.time')}</div>
                <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatTime(result.timeTaken)}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                <span>Score: {result.rawScore}/{questions.length}</span>
                <span>{percentage}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                <motion.div className="h-full rounded-full" style={{ background: color }}
                  initial={{ width: 0 }} animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={exitHref} className="btn-outline flex-1 text-sm flex items-center justify-center gap-1.5">
                <ArrowLeft size={14} /> {t('testTaking.allTests')}
              </Link>
              <Link href="/results" className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
                <BarChart2 size={14} /> {t('results.title')}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════
     STANDARD LAYOUT — PDF, passages, or no file (has top bar + controls)
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 gap-4"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link href={exitHref} className="btn-outline text-sm flex items-center gap-1.5 shrink-0">
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">{t('testTaking.exit')}</span>
          </Link>
          <h1 className="font-bold text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)' }}>
            {test.title}
          </h1>
          {saving && (
            <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
              <Save size={12} className="animate-pulse" /> {t('testTaking.saving')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
            {t('testTaking.answeredCount', { answered: answeredCount, total: questions.length })}
          </span>
          <TestTimer timeRemaining={timeRemaining} />
          <button onClick={() => setConfirmSubmit(true)} disabled={submitting} className="btn-primary text-sm">
            <Send size={14} />
            <span className="hidden sm:inline">{t('testTaking.submit')}</span>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1" style={{ minHeight: 0 }}>
        {/* Content panel */}
        <div style={{ flex: 1, minHeight: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          {fileUrl ? (
            /* PDF or other non-HTML file */
            iframeSrc ? (
              <iframe src={iframeSrc} title={test.title} style={{ width: '100%', height: '100%', border: 'none' }} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="text-center p-8">
                  <div className="text-3xl mb-3 animate-pulse">📄</div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
                </div>
              </div>
            )
          ) : passages.length > 0 ? (
            /* Legacy DB passages */
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div className="sticky top-0 flex border-b"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                {passages.map((p, i) => (
                  <button key={p.id} onClick={() => setActivePassage(i)}
                    className="flex-1 py-2.5 text-sm font-medium transition-all"
                    style={{
                      color: activePassage === i ? 'var(--accent)' : 'var(--text-muted)',
                      borderBottom: activePassage === i ? '2px solid var(--accent)' : '2px solid transparent',
                    }}>
                    {t('testTaking.passageLabel', { n: p.passage_number })}
                  </button>
                ))}
              </div>
              <div className="p-6">
                {passages[activePassage] && (
                  <motion.div key={activePassage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                      {passages[activePassage].title}
                    </h2>
                    <div className="text-sm leading-7 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                      {passages[activePassage].content}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="text-center p-8">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  {t('testTaking.contentNotUploaded')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('testTaking.uploadHint')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Question panel — desktop */}
        <div className="w-full max-w-md overflow-y-auto p-4 hidden lg:block">
          <QuestionPanel questions={questions} answers={answers} onAnswer={saveAnswer}
            currentQuestion={currentQuestion} onNavigate={setCurrentQuestion} />
        </div>
      </div>

      {/* Question panel — mobile */}
      <div className="lg:hidden p-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <QuestionPanel questions={questions} answers={answers} onAnswer={saveAnswer}
          currentQuestion={currentQuestion} onNavigate={setCurrentQuestion} />
      </div>

      {/* Confirm submit modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmSubmit(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="relative card p-6 max-w-sm w-full text-center">
            <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: 'var(--warning)' }} />
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>{t('testTaking.submitTitle')}</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {t('testTaking.submitBody', { answered: answeredCount, total: questions.length })}
            </p>
            <div className="flex gap-3">
              <button className="btn-outline flex-1" onClick={() => setConfirmSubmit(false)}>{t('test.cancel')}</button>
              <button className="btn-primary flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? t('testTaking.submitting') : t('testTaking.submit')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
