export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ReadingTestClient } from '@/components/test/ReadingTestClient'
import { isActivePremium } from '@/lib/utils/premium'

interface Props {
  params: Promise<{ testId: string }>
}

export default async function ReadingTestPage({ params }: Props) {
  const { testId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load test + profile in parallel
  const [testRes, profileRes] = await Promise.all([
    supabase
      .from('tests')
      .select('*, passages(*), questions(*)')
      .eq('id', testId)
      .eq('is_published', true)
      .single(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  if (!testRes.data) notFound()
  const test = testRes.data
  const isPremium = isActivePremium(profileRes.data)

  if (test.is_premium && !isPremium) redirect('/premium')

  // Get or create session
  let session = null
  const { data: existing } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('test_id', testId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (existing) {
    session = existing
  } else {
    const { data: created } = await supabase
      .from('test_sessions')
      .insert({ user_id: user.id, test_id: testId, status: 'in_progress', time_remaining: 3600 })
      .select()
      .single()
    session = created
  }

  if (!session) redirect('/reading')

  // Sort passages and questions
  const passages = (test.passages as any[]).sort((a: any, b: any) => a.passage_number - b.passage_number)
  const questions = (test.questions as any[]).sort((a: any, b: any) => a.question_number - b.question_number)

  return (
    <ReadingTestClient
      test={{ id: test.id, title: test.title, type: 'reading', fileUrl: test.file_url ?? null }}
      passages={passages}
      questions={questions}
      session={session}
      userId={user.id}
    />
  )
}
