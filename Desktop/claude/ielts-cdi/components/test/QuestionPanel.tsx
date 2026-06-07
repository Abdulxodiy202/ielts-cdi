'use client'

interface Question {
  id: string
  question_number: number
  question_text: string
  question_type: string
  options: string[] | null
  passage_id: string | null
}

interface QuestionPanelProps {
  questions: Question[]
  answers: Record<string, string>
  onAnswer: (questionId: string, answer: string) => void
  currentQuestion: number
  onNavigate: (index: number) => void
}

export function QuestionPanel({ questions, answers, onAnswer, currentQuestion, onNavigate }: QuestionPanelProps) {
  const q = questions[currentQuestion]
  if (!q) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Question grid nav */}
      <div className="card p-4">
        <div className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
          Question Navigation
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {questions.map((qq, i) => {
            const answered = !!answers[qq.id]
            const active = i === currentQuestion
            return (
              <button
                key={qq.id}
                onClick={() => onNavigate(i)}
                className="w-8 h-8 rounded-md text-xs font-bold transition-all"
                style={{
                  background: active
                    ? 'var(--accent)'
                    : answered
                    ? 'rgba(34,197,94,0.2)'
                    : 'var(--bg-secondary)',
                  color: active
                    ? 'white'
                    : answered
                    ? 'var(--success)'
                    : 'var(--text-muted)',
                  border: active ? 'none' : answered ? '1px solid var(--success)' : '1px solid var(--border)',
                }}
              >
                {qq.question_number}
              </button>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ background: 'var(--accent)' }} />
            Current
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid var(--success)' }} />
            Answered ({Object.keys(answers).length})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded inline-block" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} />
            Skipped
          </span>
        </div>
      </div>

      {/* Current question */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {q.question_number}
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
            {q.question_type.replace(/_/g, ' ')}
          </span>
        </div>

        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-primary)' }}>
          {q.question_text}
        </p>

        {q.question_type === 'multiple_choice' && q.options && (
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i)
              const selected = answers[q.id] === letter
              return (
                <button
                  key={i}
                  onClick={() => onAnswer(q.id, letter)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg text-sm text-left transition-all"
                  style={{
                    background: selected ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: selected ? 'white' : 'var(--text-primary)',
                    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  <span className="font-bold shrink-0">{letter}.</span>
                  <span>{opt}</span>
                </button>
              )
            })}
          </div>
        )}

        {q.question_type === 'true_false_not_given' && (
          <div className="flex gap-3">
            {['TRUE', 'FALSE', 'NOT GIVEN'].map(opt => (
              <button
                key={opt}
                onClick={() => onAnswer(q.id, opt)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: answers[q.id] === opt ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: answers[q.id] === opt ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${answers[q.id] === opt ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.question_type === 'yes_no_not_given' && (
          <div className="flex gap-3">
            {['YES', 'NO', 'NOT GIVEN'].map(opt => (
              <button
                key={opt}
                onClick={() => onAnswer(q.id, opt)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: answers[q.id] === opt ? 'var(--accent)' : 'var(--bg-secondary)',
                  color: answers[q.id] === opt ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${answers[q.id] === opt ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {(q.question_type === 'short_answer' || q.question_type === 'completion') && (
          <input
            className="input-field"
            placeholder="Type your answer here..."
            value={answers[q.id] ?? ''}
            onChange={e => onAnswer(q.id, e.target.value)}
          />
        )}

        {/* Prev / Next */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => onNavigate(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            className="btn-outline text-sm"
            style={{ opacity: currentQuestion === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>
          <button
            onClick={() => onNavigate(Math.min(questions.length - 1, currentQuestion + 1))}
            disabled={currentQuestion === questions.length - 1}
            className="btn-primary text-sm"
            style={{ opacity: currentQuestion === questions.length - 1 ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
