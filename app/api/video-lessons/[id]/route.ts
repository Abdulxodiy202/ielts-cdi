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
      // Client renders these fields — everything else on the row
      // (created_at, is_published, admin metadata) never reaches the UI.
      .select('id, title, video_url, video_source, thumbnail_url, recommendation, is_premium, category, playlist_id')
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

  // Video biror playlist ichida bo'lsa -- YouTube'dagi "Up next" panelini
  // qurish uchun o'sha playlistning nomini va ichidagi qolgan videolar
  // ro'yxatini (tartib bilan) qo'shib yuboramiz. Standalone video uchun
  // ikkalasi ham null/bo'sh qaytadi va frontend panelni ko'rsatmaydi.
  let playlist: { id: string; title: string } | null = null
  let playlistVideos: Array<{
    id: string
    title: string
    thumbnail_url: string | null
    video_url: string
    video_source: string | null
    is_premium: boolean
  }> = []

  if (video.playlist_id) {
    const [playlistRow, siblingsRes] = await Promise.all([
      admin.from('video_playlists').select('id, title').eq('id', video.playlist_id).single(),
      admin
        .from('video_lessons')
        .select('id, title, thumbnail_url, video_url, video_source, is_premium, order_in_playlist')
        .eq('playlist_id', video.playlist_id)
        .eq('is_published', true)
        .order('order_in_playlist', { ascending: true }),
    ])
    if (playlistRow.data) playlist = playlistRow.data
    playlistVideos = siblingsRes.data ?? []
  }

  return Response.json({ video: safeVideo, userPremium, playlist, playlistVideos })
}
