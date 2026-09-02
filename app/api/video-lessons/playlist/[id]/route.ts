export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'

// Bitta playlistning tafsilotlari + ichidagi (nashr etilgan) videolar
// ro'yxati, tartib bo'yicha. /video-lessons/playlist/[id] sahifasi
// shundan foydalanadi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [playlistRes, videosRes, profileRes] = await Promise.all([
    admin
      .from('video_playlists')
      .select('id, title, description, category')
      .eq('id', id)
      .eq('is_published', true)
      .single(),
    admin
      .from('video_lessons')
      .select('id, title, video_url, video_source, thumbnail_url, recommendation, is_premium, category, order_in_playlist')
      .eq('playlist_id', id)
      .eq('is_published', true)
      .order('order_in_playlist', { ascending: true }),
    supabase
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single(),
  ])

  if (playlistRes.error) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json({
    playlist: playlistRes.data,
    videos: videosRes.data ?? [],
    userPremium: isActivePremium(profileRes.data),
  })
}
