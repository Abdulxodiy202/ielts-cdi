'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Answer {
  questionId: string
  answer: string
}

interface UseTestOptions {
  sessionId: string
  testId: string
  initialTimeRemaining: number
  onTimeUp: () => void
}

export function useTest({ sessionId, testId, initialTimeRemaining, onTimeUp }: UseTestOptions) {
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Restore saved answers
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('user_answers')
        .select('question_id, user_answer')
        .eq('session_id', sessionId)
      if (data) {
        const map: Record<string, string> = {}
        data.forEach(a => { map[a.question_id] = a.user_answer ?? '' })
        setAnswers(map)
      }
    }
    load()
  }, [sessionId])

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          onTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [onTimeUp])

  // Persist remaining time every 10 seconds
  useEffect(() => {
    const persist = setInterval(async () => {
      await supabase
        .from('test_sessions')
        .update({ time_remaining: timeRemaining })
        .eq('id', sessionId)
    }, 10000)
    return () => clearInterval(persist)
  }, [sessionId, timeRemaining])

  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    setSaving(true)
    await supabase.from('user_answers').upsert(
      { session_id: sessionId, question_id: questionId, user_answer: answer },
      { onConflict: 'session_id,question_id' }
    )
    setSaving(false)
  }, [sessionId])

  return { timeRemaining, answers, saving, saveAnswer }
}
