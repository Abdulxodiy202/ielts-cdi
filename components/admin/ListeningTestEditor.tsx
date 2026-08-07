'use client'

import { useState, useCallback, useRef } from 'react'
import { ChevronDown, ChevronUp, Save, RotateCcw, Loader2, Upload, Music } from 'lucide-react'
import { QuestionRow, makeEmptyQuestion } from './QuestionRow'
import type { QuestionState } from './QuestionRow'

interface SectionState {
  audioUrl: string
  audioFile: File | null
}

interface Test {
  id: string
  title: string
}

interface Props {
  tests: Test[]
}

const SECTION_RANGES = [
  { label: 'Section 1', start: 1, count: 10, sectionNum: 1 },
  { label: 'Section 2', start: 11, count: 10, sectionNum: 2 },
  { label: 'Section 3', start: 21, count: 10, sectionNum: 3 },
  { label: 'Section 4', start: 31, count: 10, sectionNum: 4 },
]

function makeEmptySections(): SectionState[] {
  return SECTION_RANGES.map(() => ({ audioUrl: '', audioFile: null }))
}

function makeEmptyQuestions(): QuestionState[] {
  return Array.from({ length: 40 }, (_, i) => makeEmptyQuestion(i + 1))
}

function sectionNumForQuestion(qNum: number): number {
  if (qNum <= 10) return 1
  if (qNum <= 20) return 2
  if (qNum <= 30) return 3
  return 4
}

export function ListeningTestEditor({ tests }: Props) {
  const [selectedTestId, setSelectedTestId] = useState('')
  const [sections, setSections] = useState<SectionState[]>(makeEmptySections)
  const [questions, setQuestions] = useState<QuestionState[]>(makeEmptyQuestions)
  const [expandedSection, setExpandedSection] = useState<number | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingSection, setUploadingSection] = useState<number | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const reset = () => {
    setSections(makeEmptySections())
    setQuestions(makeEmptyQuestions())
    setExpandedSection(null)
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

      // Sections (passages in DB)
      const newSections = makeEmptySections()
      for (const p of dbP) {
        const idx = (p.passage_number as number) - 1
        if (idx >= 0 && idx < 4) {
          newSections[idx] = { audioUrl: p.audio_url ?? '', audioFile: null }
        }
      }
      setSections(newSections)

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
      if (dbP.length > 0) setExpandedSection(0)
    } catch {
      setMessage({ ok: false, text: 'Content yuklanmadi' })
    } finally {
      setLoadingContent(false)
    }
  }

  const handleAudioSelect = (sectionIdx: number, file: File) => {
    setSections(prev => {
      const next = [...prev]
      next[sectionIdx] = { ...next[sectionIdx], audioFile: file }
      return next
    })
  }

  const uploadAudio = async (sectionIdx: number): Promise<string | null> => {
    const file = sections[sectionIdx].audioFile
    if (!file) return sections[sectionIdx].audioUrl || null

    setUploadingSection(sectionIdx)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('testId', selectedTestId)
      formData.append('sectionNumber', String(sectionIdx + 1))

      const res = await fetch('/api/admin/audio-upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Audio yuklanmadi')
      const { url } = await res.json()
      return url as string
    } finally {
      setUploadingSection(null)
    }
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
      // Upload any new audio files first
      const audioUrls: (string | null)[] = await Promise.all(
        sections.map((_, i) => uploadAudio(i))
      )

      // Update section state with new URLs
      setSections(prev =>
        prev.map((s, i) => ({ ...s, audioUrl: audioUrls[i] ?? s.audioUrl, audioFile: null }))
      )

      const body = {
        passages: SECTION_RANGES.map(({ sectionNum }, i) => ({
          passageNumber: sectionNum,
          title: `Section ${sectionNum}`,
          content: '',
          audioUrl: audioUrls[i] ?? sections[i].audioUrl ?? null,
        })),
        questions: questions.map(q => ({
          passageNumber: sectionNumForQuestion(q.questionNumber),
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
          Listening Test tanlang
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
          Yuqoridan listening test tanlang
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
      {selectedTestId && !loadingContent && SECTION_RANGES.map(({ label, start, count, sectionNum }, secIdx) => {
        const secQs = questions.slice(start - 1, start - 1 + count)
        const isOpen = expandedSection === secIdx
        const section = sections[secIdx]
        const isUploadingThis = uploadingSection === secIdx
        const hasAudio = section.audioFile || section.audioUrl

        return (
          <div key={secIdx} className="card overflow-hidden">
            {/* Section header + audio */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {label}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Q{start}–Q{start + count - 1}
                </span>
              </div>

              {/* Audio upload */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: hasAudio ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {isUploadingThis ? (
                    <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  ) : (
                    <Music size={16} style={{ color: hasAudio ? 'var(--accent)' : 'var(--text-muted)' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {section.audioFile ? (
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {section.audioFile.name}
                    </p>
                  ) : section.audioUrl ? (
                    <p className="text-xs truncate" style={{ color: 'var(--accent)' }}>
                      {section.audioUrl.split('/').pop()}
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Audio fayl tanlanmagan
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRefs.current[secIdx]?.click()}
                  className="btn-outline text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Upload size={12} />
                  {section.audioUrl && !section.audioFile ? 'Almashtirish' : 'Audio yuklash'}
                </button>
                <input
                  ref={el => { fileInputRefs.current[secIdx] = el }}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleAudioSelect(secIdx, file)
                  }}
                />
              </div>
            </div>

            {/* Questions toggle */}
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
                style={{ color: 'var(--text-secondary)', background: 'transparent' }}
                onClick={() => setExpandedSection(isOpen ? null : secIdx)}
              >
                <span>Savollar ({count} ta, Q{start}–Q{start + count - 1})</span>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isOpen && (
                <div
                  className="px-4 pb-4 space-y-2"
                  style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}
                >
                  {secQs.map(q => (
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
