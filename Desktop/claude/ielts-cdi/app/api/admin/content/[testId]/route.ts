export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'maxmudovamashxura71@gmail.com'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

/* ── GET: fetch existing content for a test ─────────────────────────── */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const user = await verifyAdmin()
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { testId } = await params
  const admin = createAdminClient()

  const [{ data: passages }, { data: questions }] = await Promise.all([
    admin
      .from('passages')
      .select('*')
      .eq('test_id', testId)
      .order('passage_number'),
    admin
      .from('questions')
      .select('*')
      .eq('test_id', testId)
      .order('question_number'),
  ])

  return Response.json({ passages: passages ?? [], questions: questions ?? [] })
}

/* ── PUT: replace all content for a test ────────────────────────────── */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const user = await verifyAdmin()
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { testId } = await params
  const admin = createAdminClient()

  const { passages, questions } = await request.json() as {
    passages: Array<{
      passageNumber: number
      title: string
      content: string
      audioUrl?: string | null
    }>
    questions: Array<{
      passageNumber: number
      questionNumber: number
      questionText: string
      questionType: string
      options: Record<string, string> | null
      correctAnswer: string
    }>
  }

  /* 1. Delete existing questions then passages */
  await admin.from('questions').delete().eq('test_id', testId)
  await admin.from('passages').delete().eq('test_id', testId)

  /* 2. Insert passages */
  const passageRows = passages.map(p => ({
    test_id: testId,
    passage_number: p.passageNumber,
    title: p.title || `Passage ${p.passageNumber}`,
    content: p.content || '',
    audio_url: p.audioUrl ?? null,
  }))

  const { data: insertedPassages, error: passErr } = await admin
    .from('passages')
    .insert(passageRows)
    .select('id, passage_number')

  if (passErr) return Response.json({ error: passErr.message }, { status: 500 })

  /* 3. Build passage_number → uuid map */
  const passageIdMap: Record<number, string> = {}
  for (const p of insertedPassages ?? []) {
    passageIdMap[p.passage_number] = p.id
  }

  /* 4. Insert non-empty questions */
  const questionRows = questions
    .filter(q => q.questionText?.trim())
    .map(q => ({
      test_id: testId,
      passage_id: passageIdMap[q.passageNumber] ?? null,
      section_number: q.passageNumber,
      question_number: q.questionNumber,
      question_text: q.questionText,
      question_type: q.questionType,
      options: q.questionType === 'multiple_choice' ? q.options : null,
      correct_answer: q.correctAnswer,
    }))

  if (questionRows.length > 0) {
    const { error: qErr } = await admin.from('questions').insert(questionRows)
    if (qErr) return Response.json({ error: qErr.message }, { status: 500 })
  }

  return Response.json({
    success: true,
    passagesCreated: insertedPassages?.length ?? 0,
    questionsCreated: questionRows.length,
  })
}
