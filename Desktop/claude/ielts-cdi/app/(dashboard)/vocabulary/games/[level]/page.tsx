export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'
import { canUnlockLevel } from '@/lib/utils/gameUnlock'
import GameClient from './GameClient'

export default async function GameLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { level } = await params
  const levelNum = parseInt(level)
  if (isNaN(levelNum) || levelNum < 1 || levelNum > 100) redirect('/vocabulary/games')

  const admin = createAdminClient()

  const profileRes = await supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single()
  const isPremium = isActivePremium(profileRes.data)
  const unlockCheck = await canUnlockLevel(admin, user.id, levelNum, isPremium, user.email)
  if (!unlockCheck.canUnlock) redirect(`/vocabulary/games?locked=${unlockCheck.reason}`)

  // Single round-trip: level + questions together, parallel with progress
  const [levelRes, progressRes] = await Promise.all([
    admin.from('game_levels')
      .select('id, title, game_questions(id, question, correct_answer, options, hint, order_index)')
      .eq('level_number', levelNum)
      .maybeSingle(),
    admin.from('game_progress')
      .select('score, max_score, is_completed')
      .eq('user_id', user.id)
      .eq('level_number', levelNum)
      .maybeSingle(),
  ])

  const questions = ((levelRes.data as any)?.game_questions ?? [])
    .slice()
    .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))

  return (
    <GameClient
      levelNumber={levelNum}
      title={levelRes.data?.title ?? `Level ${levelNum}`}
      questions={questions}
      initialProgress={progressRes.data ?? null}
    />
  )
}
