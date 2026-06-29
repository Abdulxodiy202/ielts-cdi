'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D']

export default function GameClient({ levelNumber, title, questions, initialProgress }: Props) {
  const router = useRouter()
  const [shuffledQuestions, setShuffledQuestions] = useState<(Question & { shuffledOptions: string[] })[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [hintVisible, setHintVisible] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setShuffledQuestions(
      questions.map(q => ({ ...q, shuffledOptions: shuffle(q.options) }))
    )
  }, [questions])

  const currentQ = shuffledQuestions[currentIdx]

  function handleSelect(option: string) {
    if (answered) return
    setSelected(option)
    setAnswered(true)
    if (option === currentQ.correct_answer) {
      setScore(s => s + 1)
    }
  }

  async function handleNext() {
    if (currentIdx < shuffledQuestions.length - 1) {
      setCurrentIdx(i => i + 1)
      setSelected(null)
      setAnswered(false)
      setHintVisible(false)
    } else {
      const finalScore = score + (selected === currentQ.correct_answer ? 0 : 0)
      setSaving(true)
      const actualScore = answered && selected === currentQ.correct_answer ? score : score
      await saveProgress(actualScore)
      setSaving(false)
      setShowResult(true)
    }
  }

  async function saveProgress(finalScore: number) {
    try {
      await fetch('/api/game/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level_number: levelNumber,
          score: finalScore,
          max_score: shuffledQuestions.length,
          is_completed: finalScore >= Math.ceil(shuffledQuestions.length * 0.6),
        }),
      })
    } catch { }
  }

  if (questions.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Bu daraja uchun savollar hali qo'shilmagan.</p>
        <button
          onClick={() => router.push('/vocabulary/games')}
          style={{ marginTop: 24, padding: '10px 24px', borderRadius: 10, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
        >
          ← Orqaga
        </button>
      </div>
    )
  }

  if (showResult) {
    const isPerfect = score === shuffledQuestions.length
    const isPassed = score >= Math.ceil(shuffledQuestions.length * 0.6)
    return (
      <div style={{ padding: '40px 24px', maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {isPerfect ? '🏆' : isPassed ? '🎉' : '😔'}
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
          {isPerfect ? 'Mukammal!' : isPassed ? 'Tabriklaymiz!' : 'Qayta urinib ko\'ring'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 8 }}>
          {isPassed ? `Daraja muvaffaqiyatli o'tildi` : 'Keyingi safar yaxshiroq bo\'ladi'}
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: isPassed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${isPassed ? '#22c55e' : '#ef4444'}`,
          borderRadius: 14, padding: '12px 24px', marginBottom: 32,
        }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: isPassed ? '#22c55e' : '#ef4444' }}>{score}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>/ {shuffledQuestions.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => router.push('/vocabulary/games')}
            style={{ padding: '12px 24px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            ← Yo'lak
          </button>
          {!isPassed && (
            <button
              onClick={() => {
                setShuffledQuestions(questions.map(q => ({ ...q, shuffledOptions: shuffle(q.options) })))
                setCurrentIdx(0); setSelected(null); setAnswered(false)
                setScore(0); setHintVisible(false); setShowResult(false)
              }}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
            >
              🔄 Qayta
            </button>
          )}
          {isPassed && (
            <button
              onClick={() => router.push(`/vocabulary/games/${levelNumber + 1}`)}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
            >
              Keyingi daraja →
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!currentQ) return null

  const isCorrect = answered && selected === currentQ.correct_answer

  return (
    <div style={{ padding: '24px 16px', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          onClick={() => router.push('/vocabulary/games')}
          style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}
        >
          ← Yo'lak
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          {levelNumber}-daraja • {currentIdx + 1}/{shuffledQuestions.length}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6' }}>
          {score} ✓
        </span>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 4, marginBottom: 8, height: 6, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          background: 'linear-gradient(90deg,#8b5cf6,#6d28d9)',
          width: `${((currentIdx) / shuffledQuestions.length) * 100}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 24, marginBottom: 16, marginTop: 16,
      }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {currentQ.question}
        </p>
        {currentQ.hint && !answered && (
          <div style={{ marginTop: 12 }}>
            {hintVisible ? (
              <p style={{ margin: 0, fontSize: 13, color: '#f59e0b', fontStyle: 'italic' }}>
                💡 {currentQ.hint}
              </p>
            ) : (
              <button
                onClick={() => setHintVisible(true)}
                style={{ border: '1px solid #f59e0b33', background: '#f59e0b11', color: '#f59e0b', borderRadius: 8, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >
                💡 Ko'rsatma
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {currentQ.shuffledOptions.map((option, i) => {
          let bg = 'var(--bg-card)'
          let border = '1px solid var(--border)'
          let color = 'var(--text-primary)'

          if (answered) {
            if (option === currentQ.correct_answer) {
              bg = 'rgba(34,197,94,0.12)'; border = '2px solid #22c55e'; color = '#22c55e'
            } else if (option === selected) {
              bg = 'rgba(239,68,68,0.12)'; border = '2px solid #ef4444'; color = '#ef4444'
            }
          } else if (selected === option) {
            bg = 'rgba(139,92,246,0.12)'; border = '2px solid #8b5cf6'; color = '#8b5cf6'
          }

          return (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 16px',
                borderRadius: 12, border, background: bg, color,
                cursor: answered ? 'default' : 'pointer',
                fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <span style={{
                width: 26, height: 26, borderRadius: 8, border: `1px solid ${color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0, opacity: 0.8,
              }}>
                {OPTION_LETTERS[i]}
              </span>
              {option}
            </button>
          )
        })}
      </div>

      {answered && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
              color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {currentIdx < shuffledQuestions.length - 1 ? 'Keyingi →' : saving ? 'Saqlanmoqda...' : 'Yakunlash ✓'}
          </button>
        </div>
      )}
    </div>
  )
}
