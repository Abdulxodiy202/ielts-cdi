'use client'

export type QuestionType = 'fill_blank' | 'multiple_choice' | 'true_false_not_given' | 'matching'

export interface QuestionState {
  questionNumber: number
  questionText: string
  questionType: QuestionType
  options: { A: string; B: string; C: string; D: string }
  correctAnswer: string
}

export function makeEmptyQuestion(num: number): QuestionState {
  return {
    questionNumber: num,
    questionText: '',
    questionType: 'fill_blank',
    options: { A: '', B: '', C: '', D: '' },
    correctAnswer: '',
  }
}

const inputStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  outline: 'none',
  width: '100%',
}

export function QuestionRow({
  q,
  onChange,
}: {
  q: QuestionState
  onChange: (updated: QuestionState) => void
}) {
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      {/* Top row: number + type + text */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent)',
            minWidth: 20,
            textAlign: 'center',
            paddingTop: 6,
          }}
        >
          {q.questionNumber}
        </span>

        <select
          value={q.questionType}
          onChange={e =>
            onChange({ ...q, questionType: e.target.value as QuestionType, correctAnswer: '' })
          }
          style={{
            ...inputStyle,
            width: 'auto',
            flexShrink: 0,
            cursor: 'pointer',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <option value="fill_blank">Fill Blank</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="true_false_not_given">T / F / NG</option>
          <option value="matching">Matching</option>
        </select>

        <textarea
          value={q.questionText}
          onChange={e => onChange({ ...q, questionText: e.target.value })}
          placeholder={`Question ${q.questionNumber}…`}
          rows={2}
          style={{ ...inputStyle, flex: 1, resize: 'vertical' }}
        />
      </div>

      {/* Answer section — indented to align with textarea */}
      <div style={{ paddingLeft: 28 }}>
        {q.questionType === 'multiple_choice' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
              {(['A', 'B', 'C', 'D'] as const).map(opt => (
                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', minWidth: 14 }}>
                    {opt}:
                  </span>
                  <input
                    value={q.options[opt]}
                    onChange={e => onChange({ ...q, options: { ...q.options, [opt]: e.target.value } })}
                    placeholder={`Option ${opt}`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Correct:</span>
              {(['A', 'B', 'C', 'D'] as const).map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={`mc-correct-${q.questionNumber}`}
                    value={opt}
                    checked={q.correctAnswer === opt}
                    onChange={() => onChange({ ...q, correctAnswer: opt })}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {q.questionType === 'true_false_not_given' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Answer:</span>
            {['True', 'False', 'Not Given'].map(val => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`tfng-${q.questionNumber}`}
                  value={val}
                  checked={q.correctAnswer === val}
                  onChange={() => onChange({ ...q, correctAnswer: val })}
                />
                <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{val}</span>
              </label>
            ))}
          </div>
        )}

        {(q.questionType === 'fill_blank' || q.questionType === 'matching') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Answer:
            </span>
            <input
              value={q.correctAnswer}
              onChange={e => onChange({ ...q, correctAnswer: e.target.value })}
              placeholder="Correct answer"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
