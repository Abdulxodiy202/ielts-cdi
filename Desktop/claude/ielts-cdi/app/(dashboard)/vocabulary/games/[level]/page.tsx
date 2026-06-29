export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import GameClient from './GameClient'

export default async function GameLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { level } = await params
  const levelNum = parseInt(level)
  if (isNaN(levelNum) || levelNum < 1 || levelNum > 100) redirect('/vocabulary/games')

  const admin = createAdminClient()

  const [levelRes, progressRes] = await Promise.all([
    admin.from('game_levels').select('id, title, description, difficulty').eq('level_number', levelNum).maybeSingle(),
    admin.from('game_progress').select('score, max_score, is_completed').eq('user_id', user.id).eq('level_number', levelNum).maybeSingle(),
  ])

  let questions: any[] = []
  if (levelRes.data) {
    const { data: qs } = await admin
      .from('game_questions')
      .select('id, question, correct_answer, options, hint, order_index')
      .eq('level_id', levelRes.data.id)
      .order('order_index')
    questions = qs ?? []
  }

  return (
    <GameClient
      levelNumber={levelNum}
      title={levelRes.data?.title ?? `Level ${levelNum}`}
      questions={questions}
      initialProgress={progressRes.data ?? null}
    />
  )
}
