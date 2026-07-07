'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

/* ── Types ────────────────────────────────────────────────────────── */
interface Question {
  id: string
  question: string
  correct_answer: string
  options: string[]
  hint: string | null
}

interface Props {
  levelNumber: number
  title: string
  questions: Question[]
  initialProgress: { score: number; max_score: number; is_completed: boolean } | null
}

/* ── Helpers ──────────────────────────────────────────────────────── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LETTERS = ['A', 'B', 'C', 'D'] as const

/* ── CSS animations ───────────────────────────────────────────────── */
const CSS = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  18%     { transform: translateX(-7px); }
  36%     { transform: translateX(7px); }
  54%     { transform: translateX(-4px); }
  72%     { transform: translateX(4px); }
}
@keyframes correctPop {
  0%,100% { transform: scale(1); }
  40%     { transform: scale(1.04); }
}
@keyframes resultIn {
  from { opacity: 0; transform: scale(.92) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes hintIn {
  from { opacity: 0; transform: translateY(-5px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes confettiFall {
  0%   { transform: translateY(0) rotate(0deg)   scaleX(1);   opacity: 1; }
  80%  { opacity: .8; }
  100% { transform: translateY(108vh) rotate(760deg) scaleX(.8); opacity: 0; }
}
@keyframes progressFill {
  from { opacity: .6; }
  to   { opacity: 1; }
}
@keyframes feedbackIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes starPop {
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  60%  { transform: scale(1.35) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
`

/* ── Star logic ───────────────────────────────────────────────────── */
function getPassThreshold(total: number): number {
  return total === 100 ? 75 : 25
}

function computeStars(score: number, total: number): number {
  if (total === 100) {
    if (score >= 100) return 5
    if (score >= 95)  return 4
    if (score >= 90)  return 3
    if (score >= 85)  return 2
    if (score >= 80)  return 1
    return 0
  }
  if (score >= 30) return 5
  if (score >= 29) return 4
  if (score >= 28) return 3
  if (score >= 27) return 2
  if (score >= 26) return 1
  return 0
}

/* ── Confetti ─────────────────────────────────────────────────────── */
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 56 }, (_, i) => ({
    id:    i,
    x:     Math.random() * 100,
    color: ['#f59e0b','#22c55e','#6366f1','#ec4899','#38bdf8','#a78bfa','#fb923c'][i % 7],
    w:     6 + Math.random() * 6,
    h:     8 + Math.random() * 8,
    delay: (Math.random() * 0.6).toFixed(2) + 's',
    dur:   (1.3 + Math.random() * 1.1).toFixed(2) + 's',
    round: Math.random() > 0.55,
  })), [])
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 250, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: -16,
          width: p.w, height: p.h,
          borderRadius: p.round ? '50%' : 3,
          background: p.color,
          animation: `confettiFall ${p.dur} ease-in ${p.delay} forwards`,
        }} />
      ))}
    </div>
  )
}

/* ── Countdown ring ───────────────────────────────────────────────── */
function CountdownRing({ correct }: { correct: boolean }) {
  const c  = '#22c55e'
  const e  = '#ef4444'
  const r  = 16
  const ci = 2 * Math.PI * r
  return (
    <svg width={40} height={40} viewBox="0 0 40 40">
      <circle cx={20} cy={20} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={3} />
      <circle cx={20} cy={20} r={r} fill="none"
        stroke={correct ? c : e} strokeWidth={3}
        strokeDasharray={ci} strokeDashoffset={0}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        style={{
          animation: 'progressFill 1.2s linear forwards',
          strokeDashoffset: ci,
          animationName: 'none',
          /* inline keyframe via style */
        }}
      />
      {/* Use a simple shrinking circle via CSS custom property */}
    </svg>
  )
}

/* ── Main component ───────────────────────────────────────────────── */
export default function GameClient({ levelNumber, title, questions, initialProgress }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const total  = questions.length

  /* Shuffled questions (client-only) */
  const [shuffled, setShuffled] = useState<(Question & { opts: string[] })[]>([])
  useEffect(() => {
    setShuffled(questions.map(q => ({ ...q, opts: shuffle(q.options) })))
  }, [questions])

  const [idx,      setIdx]      = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [results,  setResults]  = useState<(boolean | null)[]>(() => Array(total).fill(null))
  const [hintOpen, setHintOpen] = useState(false)
  const [done,     setDone]     = useState(false)

  const q = shuffled[idx]

  /* ── Select answer ── */
  const handleSelect = useCallback((opt: string) => {
    if (answered || !q) return
    const ok = opt === q.correct_answer
    setSelected(opt)
    setAnswered(true)
    setResults(prev => { const n = [...prev]; n[idx] = ok; return n })
  }, [answered, idx, q])

  /* ── Auto-advance after 1.2s; save DB on last question BEFORE showing result ── */
  useEffect(() => {
    if (!answered) return
    const t = setTimeout(async () => {
      if (idx < total - 1) {
        setIdx(p => p + 1)
        setSelected(null)
        setAnswered(false)
        setHintOpen(false)
      } else {
        // Last question — await save so map re-fetch always sees completed row
        const s = results.filter(r => r === true).length
        const body = {
          level_number: levelNumber,
          score: s,
          max_score: total,
          stars: computeStars(s, total),
          is_completed: s >= getPassThreshold(total),
        }
        try {
          const res = await fetch('/api/game/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          await res.json()
        } catch (err) {
          console.error('[GameClient] save error:', err)
        }
        // Bust the map's sessionStorage cache so returning shows updated progress
        try { sessionStorage.setItem('game-levels-stale', '1') } catch {}
        setDone(true)
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [answered, idx, total]) // eslint-disable-line

  /* ── Keyboard: A/B/C/D ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || !q || answered) return
      const i = ['a','b','c','d'].indexOf(e.key.toLowerCase())
      if (i >= 0 && q.opts[i]) handleSelect(q.opts[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, q, answered, handleSelect])

  /* ── No questions ── */
  if (questions.length === 0) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: '#0f0f1a',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 54 }}>🚧</div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: 0, textAlign: 'center', padding: '0 24px' }}>
            {t('games.noQuestionsYet')}
          </p>
          <button onClick={() => router.push('/vocabulary/games')}
            style={{
              marginTop: 8, padding: '11px 24px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
              color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
            }}>
            {t('games.backToPath')}
          </button>
        </div>
      </>
    )
  }

  /* ── Result screen ── */
  if (done) {
    const finalScore    = results.filter(r => r === true).length
    const passThreshold = getPassThreshold(total)
    const passed        = finalScore >= passThreshold
    const stars         = computeStars(finalScore, total)

    const retry = () => {
      setShuffled(questions.map(q => ({ ...q, opts: shuffle(q.options) })))
      setIdx(0); setSelected(null); setAnswered(false)
      setResults(Array(total).fill(null)); setHintOpen(false); setDone(false)
    }

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {stars >= 4 && <Confetti />}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(8,8,20,0.97)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflowY: 'auto',
        }}>
          <div style={{
            textAlign: 'center', padding: '32px 24px', maxWidth: 420, width: '100%',
            animation: 'resultIn .4s cubic-bezier(.4,0,.2,1)',
          }}>
            {passed ? (
              <>
                {/* ── Stars ── */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} style={{
                      fontSize: 42, display: 'inline-block',
                      animation: `starPop 0.4s cubic-bezier(.36,.07,.19,.97) ${(n - 1) * 0.15}s both`,
                      filter: n <= stars
                        ? 'drop-shadow(0 0 10px rgba(245,158,11,0.85))'
                        : 'grayscale(1) opacity(0.18)',
                    }}>⭐</span>
                  ))}
                </div>

                {/* ── Message ── */}
                <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
                  {t(`games.star${stars}`)}
                </h2>

                {/* ── Score text ── */}
                <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  {t('games.scoreText', { score: finalScore, total })}
                </p>

                {/* ── Score badge ── */}
                <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, marginBottom: 28 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: '#4ade80' }}>{finalScore}</span>
                  <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)' }}>/{total}</span>
                </div>

                {/* ── Buttons ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {levelNumber < 100 && (
                    <button onClick={() => router.push(`/vocabulary/games/${levelNumber + 1}`)}
                      style={{ padding: '14px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                      {t('games.nextLevel')}
                    </button>
                  )}
                  <button onClick={retry}
                    style={{ padding: '13px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    {t('games.retryBtn')}
                  </button>
                  <button onClick={() => router.push('/vocabulary/games')}
                    style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    {t('games.backToPath')}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ── Fail ── */}
                <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 16 }}>😔</div>
                <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 900, color: '#f87171' }}>
                  {t('games.needMoreEffort')}
                </h2>
                <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
                  {t('games.failScoreText', { score: finalScore, total })}
                </p>
                <p style={{ margin: '0 0 24px', color: 'rgba(239,68,68,0.65)', fontSize: 13 }}>
                  {t('games.thresholdText', { threshold: passThreshold })}
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, marginBottom: 28 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: '#f87171' }}>{finalScore}</span>
                  <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)' }}>/{total}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={retry}
                    style={{ padding: '14px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    {t('games.retryBtn')}
                  </button>
                  <button onClick={() => router.push('/vocabulary/games')}
                    style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    {t('games.backToPath')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  if (!q) return <style dangerouslySetInnerHTML={{ __html: CSS }} />

  const isCorrectSel = answered && selected === q.correct_answer
  const progressPct  = (idx / total) * 100

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#0d0d1c',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Top bar (48px) ─── */}
        <div style={{
          height: 48, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
          background: 'rgba(8,8,20,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <button onClick={() => router.push('/vocabulary/games')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
            {t('games.backToPathShort')}
          </button>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, letterSpacing: '.2px' }}>
            {t('games.levelLabel', { n: levelNumber, title })}
          </span>
          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            {idx + 1}/{total}
          </span>
        </div>

        {/* ── Progress bar (4px) ─── */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
          <div style={{
            height: '100%', width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #6366f1 0%, #22c55e 100%)',
            borderRadius: '0 2px 2px 0',
            transition: 'width 0.4s cubic-bezier(.4,0,.2,1)',
            boxShadow: '0 0 8px rgba(99,102,241,0.5)',
          }} />
        </div>

        {/* ── Scrollable content ─── */}
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px 24px',
          gap: 16,
        }}>

          {/* ── Question card ─── */}
          <div style={{
            width: '100%', maxWidth: 580,
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            padding: '24px 22px',
          }}>
            {/* Category badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 8, padding: '3px 10px',
              marginBottom: 14,
              fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: '.3px',
            }}>
              📚 {title}
            </div>

            {/* Question */}
            <p style={{
              margin: 0, fontSize: 19, fontWeight: 700,
              color: '#fff', lineHeight: 1.55,
            }}>
              {q.question}
            </p>

            {/* Hint */}
            {q.hint && !answered && (
              <div style={{ marginTop: 14 }}>
                {hintOpen ? (
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: 10, fontSize: 13, color: '#fcd34d',
                    animation: 'hintIn .2s ease',
                  }}>
                    💡 {q.hint}
                  </div>
                ) : (
                  <button onClick={() => setHintOpen(true)}
                    style={{
                      background: 'rgba(245,158,11,0.07)',
                      border: '1px solid rgba(245,158,11,0.18)',
                      borderRadius: 8, padding: '5px 12px',
                      color: '#fcd34d', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', outline: 'none',
                    }}>
                    {t('games.hintBtn')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── 2×2 Options grid ─── */}
          <div style={{
            width: '100%', maxWidth: 580,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 10,
          }}>
            {q.opts.map((opt, oi) => {
              const letter  = LETTERS[oi]
              const isThis  = selected === opt
              const correct = opt === q.correct_answer

              let bg       = '#15152a'
              let bord     = '1px solid rgba(255,255,255,0.07)'
              let col      = 'rgba(255,255,255,0.82)'
              let badgeBg  = '#1e1e3a'
              let badgeCol = 'rgba(255,255,255,0.4)'
              let icon: string | null = null
              let anim     = ''

              if (answered) {
                if (correct) {
                  bg = 'rgba(5,46,22,0.85)'; bord = '2px solid #22c55e'
                  col = '#86efac'; badgeBg = 'rgba(34,197,94,0.15)'; badgeCol = '#22c55e'
                  icon = '✓'; anim = 'correctPop 0.3s ease'
                } else if (isThis) {
                  bg = 'rgba(28,8,8,0.85)'; bord = '2px solid #ef4444'
                  col = '#fca5a5'; badgeBg = 'rgba(239,68,68,0.15)'; badgeCol = '#ef4444'
                  icon = '✗'; anim = 'shake 0.3s ease'
                }
              }

              return (
                <button key={opt}
                  onClick={() => handleSelect(opt)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '13px 15px', borderRadius: 13,
                    border: bord, background: bg, color: col,
                    cursor: answered ? 'default' : 'pointer',
                    fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', gap: 11,
                    transition: 'border-color .12s, background .12s',
                    animation: anim || undefined,
                    outline: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!answered) {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.borderColor = 'rgba(99,102,241,0.45)'
                      el.style.background  = 'rgba(99,102,241,0.07)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!answered) {
                      const el = e.currentTarget as HTMLButtonElement
                      el.style.borderColor = 'rgba(255,255,255,0.07)'
                      el.style.background  = '#15152a'
                    }
                  }}
                >
                  {/* Letter badge */}
                  <span style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                    background: badgeBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: icon ? 13 : 11, fontWeight: 800,
                    color: badgeCol,
                    transition: 'background .12s',
                  }}>
                    {icon ?? letter}
                  </span>
                  <span>{opt}</span>
                </button>
              )
            })}
          </div>

          {/* ── Feedback strip (appears after answer) ─── */}
          {answered && (
            <div style={{
              width: '100%', maxWidth: 580,
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 15px',
              borderRadius: 12,
              background: isCorrectSel
                ? 'rgba(34,197,94,0.07)'
                : 'rgba(239,68,68,0.07)',
              border: `1px solid ${isCorrectSel ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}`,
              animation: 'feedbackIn .2s ease',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>
                {isCorrectSel ? '🎯' : '💡'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isCorrectSel ? '#4ade80' : '#f87171' }}>
                  {isCorrectSel ? t('games.correctFeedback') : t('games.wrongFeedback', { answer: q.correct_answer })}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>
                  {t('games.loadingNext')}
                </div>
              </div>

              {/* 1.2s SVG countdown ring */}
              <svg width={36} height={36} viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                <circle cx={18} cy={18} r={14} fill="none"
                  stroke="rgba(255,255,255,0.07)" strokeWidth={2.5} />
                <circle cx={18} cy={18} r={14} fill="none"
                  stroke={isCorrectSel ? '#22c55e' : '#ef4444'} strokeWidth={2.5}
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                  style={{
                    strokeDashoffset: 0,
                    animation: `progressFill 1.2s linear forwards`,
                    animationName: 'timerDrain',
                  }}
                />
              </svg>

              {/* Inline timerDrain keyframe */}
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes timerDrain {
                  from { stroke-dashoffset: 0; }
                  to   { stroke-dashoffset: ${2 * Math.PI * 14}; }
                }
              ` }} />
            </div>
          )}

          {/* Keyboard hint */}
          {!answered && (
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' }}>
              {t('games.keyboardHint')} <kbd style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 5px' }}>A</kbd>{' '}
              <kbd style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 5px' }}>B</kbd>{' '}
              <kbd style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 5px' }}>C</kbd>{' '}
              <kbd style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 5px' }}>D</kbd>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
