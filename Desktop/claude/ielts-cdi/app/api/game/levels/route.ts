export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [levelsRes, progressRes] = await Promise.all([
    admin.from('game_levels').select('level_number, title, category').eq('is_active', true).order('level_number'),
    admin.from('game_progress').select('level_number, is_completed, stars').eq('user_id', user.id),
  ])

  const levels = levelsRes.data ?? []
  const progress = progressRes.data ?? []

  const completedSet = new Set(progress.filter(p => p.is_completed).map(p => p.level_number))
  const progressMap = Object.fromEntries(progress.map(p => [p.level_number, p]))
  const levelMap = Object.fromEntries(levels.map(l => [l.level_number, l]))

  let currentLevel = 1
  for (let i = 1; i <= 100; i++) {
    if (!completedSet.has(i)) { currentLevel = i; break }
  }

  const result = Array.from({ length: 100 }, (_, i) => {
    const num = i + 1
    const meta = levelMap[num]
    const prog = progressMap[num]
    const status = completedSet.has(num) ? 'completed' : num === currentLevel ? 'current' : 'locked'
    return {
      level_number: num,
      title: meta?.title ?? `Level ${num}`,
      description: meta?.description ?? null,
      difficulty: meta?.difficulty ?? 'medium',
      category: meta?.category ?? null,
      status,
      stars: prog?.stars ?? 0,
    }
  })

  return Response.json(result, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}
