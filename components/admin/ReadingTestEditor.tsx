'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Save, RotateCcw, Loader2 } from 'lucide-react'
import { QuestionRow, makeEmptyQuestion } from './QuestionRow'
import type { QuestionState } from './QuestionRow'

interface PassageState {
  title: string
  content: string
}

interface Test {
  id: string
  title: string
}

interface Props {
  tests: Test[]
}

const PASSAGE_RANGES = [
  { label: 'Passage 1', start: 1, count: 13, passNum: 1 },
  { label: 'Passage 2', start: 14, count: 13, passNum: 2 },
  { label: 'Passage 3', start: 27, count: 14, passNum: 3 },
]

function makeEmptyPassages(): PassageState[] {
  return [{ title: '', content: '' }, { title: '', content: '' }, { title: '', content: '' }]
}

function makeEmptyQuestions(): QuestionState[] {
  return Array.from({ length: 40 }, (_, i) => makeEmptyQuestion(i + 1))
}

function passageNumForQuestion(qNum: number): number {
  if (qNum <= 13) return 1
  if (qNum <= 26) return 2
  return 3
}

export function ReadingTestEditor({ tests }: Props) {
  const [selectedTestId, setSelectedTestId] = useState('')
  const [passages, setPassages] = useState<PassageState[]>(makeEmptyPassages)
  const [questions, setQuestions] = useState<QuestionState[]>(makeEmptyQuestions)
  const [expandedPassage, setExpandedPassage] = useState<number | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const reset = () => {
    setPassages(makeEmptyPassages())
    setQuestions(makeEmptyQuestions())
    setExpandedPassage(null)
    setMessage(null)
  }

  const handleTestSelect = async (testId: string) => {
    setSelectedTestId(testId)
    setMessage(null)
    if (!testId) { reset(); return }

    setLoadingContent(true)
    try {
      const res = await fetch(`/api/admin/content/${testId}`)
      if (!res.ok) throw new Error('Yuklanmadi')
      const { passages: dbP, questions: dbQ } = await res.json()

      // Passages
      const newPassages = makeEmptyPassages()
      for (const p of dbP) {
        const idx = (p.passage_number as number) - 1
        if (idx >= 0 && idx < 3) newPassages[idx] = { title: p.title, content: p.content }
      }
      setPassages(newPassages)

      // Questions
      const newQ = makeEmptyQuestions()
      for (const q of dbQ) {
        const idx = (q.question_number as number) - 1
        if (idx >= 0 && idx < 40) {
          newQ[idx] = {
            questionNumber: q.question_number,
            questionText: q.question_text,
            questionType: q.question_type,
            options: q.options ?? { A: '', B: '', C: '', D: '' },
            correctAnswer: q.correct_answer,
          }
        }
      }
      setQuestions(newQ)
      if (dbP.length > 0) setExpandedPassage(0)
    } catch {
      setMessage({ ok: false, text: 'Content yuklanmadi' })
    } finally {
      setLoadingContent(false)
    }
  }

  const updatePassage = (idx: number, field: keyof PassageState, val: string) => {
    setPassages(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: val }
      return next
    })
  }

  const updateQuestion = useCallback((qNum: number, updated: QuestionState) => {
    setQuestions(prev => {
      const next = [...prev]
      next[qNum - 1] = updated
      return next
    })
  }, [])

  const handleSave = async () => {
    if (!selectedTestId) return
    setSaving(true)
    setMessage(null)
    try {
      const body = {
        passages: passages.map((p, i) => ({
          passageNumber: i + 1,
          title: p.title,
          content: p.content,
          audioUrl: null,
        })),
        questions: questions.map(q => ({
          passageNumber: passageNumForQuestion(q.questionNumber),
          ...q,
          options: q.questionType === 'multiple_choice' ? q.options : null,
        })),
      }
      const res = await fetch(`/api/admin/content/${selectedTestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Xatolik')
      }
      const { questionsCreated } = await res.json()
      setMessage({ ok: true, text: `Saqlandi! ${questionsCreated} ta savol` })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Xatolik yuz berdi' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Test selector */}
      <div className="card p-4">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          Reading Test tanlang
        </label>
        <select
          value={selectedTestId}
          onChange={e => handleTestSelect(e.target.value)}
          className="input-field"
        >
          <option value="">— Test tanlang —</option>
          {tests.map(t => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {!selectedTestId && (
        <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
          Yuqoridan reading test tanlang
        </div>
      )}

      {/* Loading */}
      {selectedTestId && loadingContent && (
        <div className="card p-10 text-center">
          <Loader2 size={28} className="animate-spin mx-auto" style={{ color: 'var(--accent)' }} />
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda…</p>
        </div>
      )}

      {/* Editor */}
      {selectedTestId && !loadingContent && PASSAGE_RANGES.map(({ label, start, count, passNum }, passIdx) => {
        const passQs = questions.slice(start - 1, start - 1 + count)
        const isOpen = expandedPassage === passIdx

        return (
          <div key={passIdx} className="card overflow-hidden">
            {/* Passage inputs */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {label}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Q{start}–Q{start + count - 1}
                </span>
              </div>
              <input
                value={passages[passIdx].title}
                onChange={e => updatePassage(passIdx, 'title', e.target.value)}
                placeholder={`${label} title`}
                className="input-field text-sm"
              />
              <textarea
                value={passages[passIdx].content}
                onChange={e => updatePassage(passIdx, 'content', e.target.value)}
                placeholder="Passage matnini shu yerga joylashtiring…"
                rows={7}
                className="input-field text-sm resize-y"
              />
            </div>

            {/* Questions toggle */}
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
                style={{ color: 'var(--text-secondary)', background: 'transparent' }}
                onClick={() => setExpandedPassage(isOpen ? null : passIdx)}
              >
                <span>Savollar ({count} ta, Q{start}–Q{start + count - 1})</span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isOpen && (
                <div
                  className="px-4 pb-4 space-y-2"
                  style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}
                >
                  {passQs.map(q => (
                    <QuestionRow
                      key={q.questionNumber}
                      q={q}
                      onChange={updated => updateQuestion(q.questionNumber, updated)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Actions + message */}
      {selectedTestId && !loadingContent && (
        <div className="space-y-3">
          {message && (
            <div
              className="p-3 rounded-xl text-sm font-medium"
              style={{
                background: message.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: message.ok ? 'var(--success)' : 'var(--error)',
                border: `1px solid ${message.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}
            >
              {message.ok ? '✅' : '❌'} {message.text}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Saqlanmoqda…' : 'Testni Saqlash'}
            </button>
            <button
              onClick={() => { reset(); setSelectedTestId('') }}
              className="btn-outline flex items-center gap-2 text-sm"
            >
              <RotateCcw size={14} /> Tozalash
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
