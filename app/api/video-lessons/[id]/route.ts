export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [videoRes, profileRes] = await Promise.all([
    admin
      .from('video_lessons')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .single(),
    supabase
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single(),
  ])

  if (videoRes.error) return Response.json({ error: 'Not found' }, { status: 404 })

  // Strip the video URL for free users hitting premium content -- the
  // lock overlay renders from the remaining metadata (title, thumb,
  // recommendation), but the actual video source is never exposed.
  const userPremium = isActivePremium(profileRes.data)
  const video = videoRes.data
  const safeVideo = (video.is_premium && !userPremium)
    ? { ...video, video_url: '' }
    : video

  return Response.json({ video: safeVideo, userPremium })
}
