'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Star, ArrowLeft, RotateCcw, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { calcStarsFromScore } from '@/lib/stars'

// Per-article 30-question multiple-choice test. Flow: quiz (one question
// at a time, no timer, no auto-submit) -> result. No intro screen -- the
// hub's "Test ishlash" button lands the user directly on Q1. Result
// upsert keeps best_score/best_stars monotonic while
// last_score/last_stars/attempts always refresh. RLS on
// article_test_results already restricts writes to auth.uid() = user_id.

const TOTAL_QUESTIONS = 30
type Option = 'A' | 'B' | 'C' | 'D'

interface Question {
  question_number: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: Option
}

type Phase = 'loading' | 'unavailable' | 'quiz' | 'result'

interface BestResult {
  best_score: number
  best_stars: number
}

export default function ArticleTestPage() {
  const params = useParams()
  const articleId = params?.id as string
  const router = useRouter()
  const { t } = useLanguage()

  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, Option>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [previousBest, setPreviousBest] = useState<BestResult | null>(null)
  const [finalScore, setFinalScore] = useState(0)
  const [finalStars, setFinalStars] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!articleId) return
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [questionsRes, bestRes] = await Promise.all([
        supabase
          .from('article_tests')
          .select('question_number, question_text, option_a, option_b, option_c, option_d, correct_option')
          .eq('article_id', articleId)
          .order('question_number', { ascending: true }),
        supabase
          .from('article_test_results')
          .select('best_score, best_stars')
          .eq('user_id', user.id)
          .eq('article_id', articleId)
          .maybeSingle(),
      ])

      setPreviousBest((bestRes.data as BestResult | null) ?? null)

      const qs = (questionsRes.data ?? []) as Question[]
      // Test needs exactly 30 rows; anything less means admin hasn't
      // finished seeding, so show a friendly "coming soon" fallback.
      if (qs.length < TOTAL_QUESTIONS) {
        setPhase('unavailable')
        return
      }
      setQuestions(qs)
      setPhase('quiz')
    }
    load()
  }, [articleId, router])

  const currentQuestion = questions[currentIdx]
  const currentAnswer = currentQuestion ? answers[currentQuestion.question_number] : undefined
  const isLastQuestion = currentIdx === TOTAL_QUESTIONS - 1
  const answeredCount = Object.keys(answers).length

  async function saveResult(score: number, stars: number) {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: existing } = await supabase
        .from('article_test_results')
        .select('id, best_score, best_stars, attempts')
        .eq('user_id', user.id)
        .eq('article_id', articleId)
        .maybeSingle()

      if (!existing) {
        await supabase.from('article_test_results').insert({
          user_id: user.id,
          article_id: articleId,
          best_score: score,
          best_stars: stars,
          last_score: score,
          last_stars: stars,
          attempts: 1,
        })
      } else {
        await supabase.from('article_test_results').update({
          best_score: Math.max(existing.best_score, score),
          best_stars: Math.max(existing.best_stars, stars),
          last_score: score,
          last_stars: stars,
          attempts: (existing.attempts ?? 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      }
    } finally {
      setSaving(false)
    }
  }

  function handleFinish() {
    let correct = 0
    for (const q of questions) {
      if (answers[q.question_number] === q.correct_option) correct++
    }
    const stars = calcStarsFromScore(correct, TOTAL_QUESTIONS)
    setFinalScore(correct)
    setFinalStars(stars)
    saveResult(correct, stars)
    // Update local "previous best" view so the user sees the new record
    // reflected immediately.
    setPreviousBest(prev => {
      const bestScore = Math.max(prev?.best_score ?? 0, correct)
      const bestStars = Math.max(prev?.best_stars ?? 0, stars)
      return { best_score: bestScore, best_stars: bestStars }
    })
    setPhase('result')
  }

  function handleRetry() {
    setAnswers({})
    setCurrentIdx(0)
    setFinalScore(0)
    setFinalStars(0)
    setPhase('quiz')
  }

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (phase === 'unavailable') {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto text-center">
        <div className="text-5xl mb-4">📝</div>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('articleTest.unavailableTitle')}
        </h1>
        <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
          {t('articleTest.unavailableDesc')}
        </p>
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <ArrowLeft size={15} /> {t('articleTest.backToArticles')}
        </Link>
      </div>
    )
  }

  if (phase === 'quiz' && currentQuestion) {
    const progress = ((currentIdx + 1) / TOTAL_QUESTIONS) * 100
    const options: { key: Option; text: string }[] = [
      { key: 'A', text: currentQuestion.option_a },
      { key: 'B', text: currentQuestion.option_b },
      { key: 'C', text: currentQuestion.option_c },
      { key: 'D', text: currentQuestion.option_d },
    ]

    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Link
          href="/articles"
          className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={14} /> {t('articleTest.backToArticles')}
        </Link>

        <div className="mb-4 flex items-center justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
          <span>{t('articleTest.questionCounter', { current: currentIdx + 1, total: TOTAL_QUESTIONS })}</span>
          <span>{t('articleTest.answered', { count: answeredCount })}</span>
        </div>

        <div
          className="h-1.5 rounded-full overflow-hidden mb-6"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
        </div>

        <div
          className="rounded-2xl p-5 md:p-6 mb-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="font-semibold mb-5" style={{ color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.5 }}>
            {currentQuestion.question_text}
          </p>

          <div className="space-y-2.5">
            {options.map(({ key, text }) => {
              const selected = currentAnswer === key
              return (
                <button
                  key={key}
                  onClick={() => setAnswers(prev => ({ ...prev, [currentQuestion.question_number]: key }))}
                  className="w-full text-left flex items-start gap-3 p-3.5 rounded-xl transition-colors"
                  style={{
                    background: selected ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)',
                    border: `1px solid ${selected ? 'rgba(99,102,241,0.55)' : 'var(--border)'}`,
                    color: 'var(--text-primary)',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      background: selected ? 'var(--accent)' : 'transparent',
                      color: selected ? 'white' : 'var(--text-muted)',
                      border: selected ? 'none' : '1.5px solid var(--border)',
                    }}
                  >
                    {key}
                  </div>
                  <span className="text-sm leading-snug pt-1">{text}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={16} /> {t('articleTest.back')}
          </button>
          {isLastQuestion ? (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex-[1.4] flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold disabled:opacity-60"
              style={{ background: '#10b981', color: 'white' }}
            >
              {t('articleTest.finish')} <ClipboardCheck size={16} />
            </button>
          ) : (
            <button
              onClick={() => setCurrentIdx(i => Math.min(TOTAL_QUESTIONS - 1, i + 1))}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {t('articleTest.next')} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'result') {
    const messageKey =
      finalStars === 5 ? 'articleTest.msg5' :
      finalStars === 4 ? 'articleTest.msg4' :
      finalStars === 3 ? 'articleTest.msg3' :
      finalStars === 2 ? 'articleTest.msg2' :
      finalStars === 1 ? 'articleTest.msg1' :
      'articleTest.msg0'

    return (
      <div className="p-6 md:p-10 max-w-xl mx-auto">
        <div
          className="rounded-2xl p-6 md:p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            {t('articleTest.yourResult')}
          </p>

          <div className="flex items-center justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Star
                key={i}
                size={36}
                strokeWidth={1.5}
                fill={i <= finalStars ? '#fbbf24' : 'transparent'}
                color={i <= finalStars ? '#fbbf24' : 'var(--text-muted)'}
              />
            ))}
          </div>

          <p className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {finalScore} / {TOTAL_QUESTIONS}
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {t(messageKey)}
          </p>

          {previousBest && (
            <div
              className="rounded-xl p-3 mb-6 text-sm"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {t('articleTest.bestSoFar', {
                score: previousBest.best_score,
                stars: previousBest.best_stars,
              })}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <RotateCcw size={15} /> {t('articleTest.retry')}
            </button>
            <button
              onClick={() => router.push('/articles')}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <ArrowLeft size={15} /> {t('articleTest.backToArticles')}
            </button>
          </div>

          {saving && (
            <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('articleTest.saving')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}
