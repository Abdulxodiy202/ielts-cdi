export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // video_test_results is user-scoped, so hit it via the RLS'd client;
  // videos + profile via admin (public read / self-only).
  const [videosRes, profileRes, resultsRes] = await Promise.all([
    admin
      .from('video_lessons')
      .select('id, title, video_url, video_source, thumbnail_url, recommendation, is_premium')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single(),
    supabase
      .from('video_test_results')
      .select('video_id, best_stars, best_score')
      .eq('user_id', user.id),
  ])

  if (videosRes.error) console.error('[video-lessons] error:', videosRes.error.message)

  return Response.json({
    videos: videosRes.data ?? [],
    userPremium: isActivePremium(profileRes.data),
    // Shape kept flat -- client builds a Map by video_id.
    results: resultsRes.data ?? [],
  })
}
