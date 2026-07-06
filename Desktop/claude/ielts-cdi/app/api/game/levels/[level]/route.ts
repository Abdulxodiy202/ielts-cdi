export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'
import { canUnlockLevel } from '@/lib/utils/gameUnlock'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ level: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { level } = await params
  const levelNum = parseInt(level)
  if (isNaN(levelNum) || levelNum < 1 || levelNum > 100) {
    return Response.json({ error: 'Invalid level' }, { status: 400 })
  }

  const admin = createAdminClient()

  const profileRes = await supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single()
  const isPremium = isActivePremium(profileRes.data)
  const unlockCheck = await canUnlockLevel(admin, user.id, levelNum, isPremium, user.email)
  if (!unlockCheck.canUnlock) {
    if (unlockCheck.reason === 'daily_limit_reached') {
      return Response.json({
        error: 'daily_limit_reached',
        unlockedToday: unlockCheck.unlockedToday,
        dailyLimit: unlockCheck.dailyLimit,
        isPremium,
      }, { status: 403 })
    }
    return Response.json({ error: 'previous_level_locked' }, { status: 403 })
  }

  const { data: levelData } = await admin
    .from('game_levels')
    .select('*')
    .eq('level_number', levelNum)
    .maybeSingle()

  let questions: any[] = []
  if (levelData) {
    const { data: qs } = await admin
      .from('game_questions')
      .select('id, question, correct_answer, options, hint, order_index')
      .eq('level_id', levelData.id)
      .order('order_index')
    questions = qs ?? []
  }

  const { data: progress } = await admin
    .from('game_progress')
    .select('score, max_score, is_completed')
    .eq('user_id', user.id)
    .eq('level_number', levelNum)
    .maybeSingle()

  return Response.json({
    level_number: levelNum,
    title: levelData?.title ?? `Level ${levelNum}`,
    description: levelData?.description ?? null,
    difficulty: levelData?.difficulty ?? 'medium',
    questions,
    progress: progress ?? null,
  })
}
