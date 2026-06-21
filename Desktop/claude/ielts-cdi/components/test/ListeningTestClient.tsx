'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Save, Send, AlertTriangle, ArrowLeft, Trophy, CheckCircle, XCircle, BarChart2 } from 'lucide-react'
import Link from 'next/link'
import { TestTimer } from './TestTimer'
import { QuestionPanel } from './QuestionPanel'
import { useTest } from '@/lib/hooks/useTest'
import { getBandColor, getBandLabel } from '@/lib/utils/bandScore'
import { formatTime } from '@/lib/utils/formatters'
import { buildInjectScript } from '@/lib/utils/injectScript'

interface Question {
  id: string
  question_number: number
  question_text: string
  question_type: string
  options: string[] | null
  passage_id: string | null
}

interface ListeningTestClientProps {
  test: { id: string; title: string; fileUrl: string | null }
  questions: Question[]
  session: { id: string; time_remaining: number }
  userId: string
}


export function ListeningTestClient({ test, questions, session }: ListeningTestClientProps) {
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [result, setResult] = useState<{ rawScore: number; bandScore: number; timeTaken: number } | null>(null)
  const [showExit, setShowExit] = useState(false)   // floating Exit for HTML mode
  const [cdiSubmitted, setCdiSubmitted] = useState(false)  // CDI_SUBMIT received
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const submittedRef = useRef(false)
  const startTimeRef = useRef<number>(Date.now())

  const fileUrl = test.fileUrl
  const ext = fileUrl?.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)
  const isHtmlFile = ext === 'html' || ext === 'htm'

  /* ── Build blob URL (inject script for HTML, direct src for others) ── */
  useEffect(() => {
    if (!fileUrl || isAudio) return
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
  }, [fileUrl, isAudio, isHtmlFile])

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }, [])

  /* ── Listen for postMessage events from HTML iframe ── */
  useEffect(() => {
    if (!isHtmlFile) return
    const onMsg = (e: MessageEvent) => {
      // CDI_SUBMIT: save score to DB, show success overlay
      if (e.data?.type === 'CDI_SUBMIT') {
        if (submittedRef.current) return
        submittedRef.current = true
        const score = typeof e.data.score === 'number' ? e.data.score : 0
        const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
        fetch('/api/results/cdi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, testId: test.id, score, timeTaken }),
        }).catch(() => {})
        setCdiSubmitted(true)
        return
      }
      // Legacy CDI_CHECK_ANSWERS: only if CDI_SUBMIT not already received
      if (e.data?.type === 'CDI_CHECK_ANSWERS') {
        if (submittedRef.current) return
        fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, testId: test.id, timeRemaining: 0 }),
        }).catch(() => {})
        setShowExit(true)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [isHtmlFile, session.id, test.id])

  // Hook always called — noop for HTML (HTML manages its own timer)
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
              <div className="text-4xl mb-3 animate-pulse">🎧</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Yuklanmoqda…</p>
            </div>
          </div>
        )}

        {/* CDI_SUBMIT received — success overlay with redirect */}
        {cdiSubmitted && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'white', borderRadius: 20, padding: '48px 56px',
              textAlign: 'center', maxWidth: 360,
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 8 }}>
                Test topshirildi!
              </h2>
              <p style={{ color: '#666', fontSize: 15, marginBottom: 24 }}>
                Natijangiz saqlandi.
              </p>
              <a
                href="/dashboard"
                style={{
                  display: 'inline-block',
                  padding: '12px 28px',
                  borderRadius: 12,
                  background: '#111',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                Dashboard&apos;ga qaytish →
              </a>
            </div>
          </div>
        )}

        {/* Floating Exit button — only shown after legacy CDI_CHECK_ANSWERS */}
        {showExit && !cdiSubmitted && (
          <Link
            href="/listening"
            style={{
              position: 'fixed', bottom: 24, right: 24, zIndex: 110,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 22px', borderRadius: 14,
              background: 'var(--accent)', color: '#fff',
              fontWeight: 700, fontSize: 15, textDecoration: 'none',
              boxShadow: '0 4px 32px rgba(0,0,0,0.30)',
              transition: 'opacity 0.2s',
            }}
          >
            <ArrowLeft size={17} />
            Exit Test
          </Link>
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

    return (
      <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="flex items-center justify-between px-4 py-3 gap-4"
          style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/listening" className="btn-outline text-sm flex items-center gap-1.5 shrink-0">
              <ArrowLeft size={14} /> <span>Exit</span>
            </Link>
            <h1 className="font-bold text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)' }}>
              {test.title}
            </h1>
          </div>
          <Link href="/results" className="btn-primary text-sm flex items-center gap-1.5 shrink-0">
            <BarChart2 size={14} />
            <span className="hidden sm:inline">My Results</span>
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
                Band Score — {label}
              </div>
            </motion.div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Correct</span>
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>{result.rawScore}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle size={14} style={{ color: 'var(--error)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Wrong</span>
                </div>
                <div className="text-xl font-bold" style={{ color: 'var(--error)' }}>
                  {questions.length - result.rawScore}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Time</div>
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
              <Link href="/listening" className="btn-outline flex-1 text-sm flex items-center justify-center gap-1.5">
                <ArrowLeft size={14} /> All Tests
              </Link>
              <Link href="/results" className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5">
                <BarChart2 size={14} /> My Results
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════════
     STANDARD LAYOUT — audio or PDF file (has top bar + controls)
  ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 gap-4"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/listening" className="btn-outline text-sm flex items-center gap-1.5 shrink-0">
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Exit</span>
          </Link>
          <h1 className="font-bold text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)' }}>
            {test.title}
          </h1>
          {saving && (
            <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
              <Save size={12} className="animate-pulse" /> Saving...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>
            {answeredCount}/{questions.length} answered
          </span>
          <TestTimer timeRemaining={timeRemaining} />
          <button onClick={() => setConfirmSubmit(true)} disabled={submitting} className="btn-primary text-sm">
            <Send size={14} />
            <span className="hidden sm:inline">Submit</span>
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1" style={{ minHeight: 0 }}>
        {/* Content panel */}
        <div className="flex-1 relative flex flex-col" style={{ borderRight: '1px solid var(--border)', minHeight: 0 }}>
          {isAudio && fileUrl ? (
            <div className="flex flex-col items-center justify-center h-full p-8 gap-6">
              <div className="text-6xl">🎧</div>
              <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>{test.title}</p>
              <audio controls src={fileUrl} className="w-full max-w-lg" style={{ accentColor: 'var(--accent)' }}>
                Your browser does not support audio playback.
              </audio>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Audio tinglang va savollarni javoblang
              </p>
            </div>
          ) : fileUrl ? (
            /* PDF or other non-HTML embed */
            iframeSrc ? (
              <iframe src={iframeSrc} title={test.title}
                className="absolute inset-0 w-full h-full border-0" style={{ background: 'white' }} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <div className="text-3xl mb-3 animate-pulse">📄</div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda…</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="text-4xl mb-3">🎧</div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  Test content hali yuklanmagan
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Admin paneldan audio yoki fayl yuklang
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

      {/* Confirm submit */}
      {confirmSubmit && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmSubmit(false)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="relative card p-6 max-w-sm w-full text-center">
            <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: 'var(--warning)' }} />
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>Submit test?</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              You have answered {answeredCount} of {questions.length} questions. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn-outline flex-1" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
