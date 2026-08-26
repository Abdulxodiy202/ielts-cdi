export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Video test feature removed entirely (no more per-video quiz/scoring),
  // so this no longer needs to fetch video_test_results alongside the
  // video list -- just videos + the user's premium status.
  const [videosRes, profileRes] = await Promise.all([
    admin
      .from('video_lessons')
      .select('id, title, video_url, video_source, thumbnail_url, recommendation, is_premium, category')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single(),
  ])

  if (videosRes.error) console.error('[video-lessons] error:', videosRes.error.message)

  return Response.json({
    videos: videosRes.data ?? [],
    userPremium: isActivePremium(profileRes.data),
  })
}
