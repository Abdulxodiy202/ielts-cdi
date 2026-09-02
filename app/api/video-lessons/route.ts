export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isActivePremium } from '@/lib/utils/premium'

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Video test feature removed entirely (no more per-video quiz/scoring),
  // so this no longer needs to fetch video_test_results alongside the
  // video list -- just videos + playlists + the user's premium status.
  const [videosRes, playlistsRes, profileRes] = await Promise.all([
    admin
      .from('video_lessons')
      .select('id, title, video_url, video_source, thumbnail_url, recommendation, is_premium, category, playlist_id, order_in_playlist')
      .eq('is_published', true)
      .order('created_at', { ascending: false }),
    admin
      .from('video_playlists')
      .select('id, title, description, thumbnail_url, category')
      .eq('is_published', true)
      .order('order_index', { ascending: true }),
    supabase
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', user.id)
      .single(),
  ])

  if (videosRes.error) console.error('[video-lessons] error:', videosRes.error.message)
  if (playlistsRes.error) console.error('[video-lessons] playlists error:', playlistsRes.error.message)

  const allVideos = videosRes.data ?? []

  // Playlistga tegishli bo'lmagan (standalone) videolar -- bosh
  // sahifadagi "Videolar" filtrida shular ko'rinadi. Playlistga
  // qo'shilgan video endi faqat o'sha playlist ichida chiqadi, flat
  // ro'yxatda takrorlanmaydi.
  const standaloneVideos = allVideos.filter(v => !v.playlist_id)

  // Har bir playlist uchun video sonini va (admin o'zi belgilamagan
  // bo'lsa) birinchi videoning thumbnail'ini hisoblab qo'shamiz --
  // YouTube'dagi playlist kartochkasi kabi.
  const playlists = (playlistsRes.data ?? [])
    .map(p => {
      const inPlaylist = allVideos
        .filter(v => v.playlist_id === p.id)
        .sort((a, b) => (a.order_in_playlist ?? 0) - (b.order_in_playlist ?? 0))
      const firstVideo = inPlaylist[0]
      const firstYtId  = firstVideo ? getYouTubeId(firstVideo.video_url) : null
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        video_count: inPlaylist.length,
        thumbnail_url: p.thumbnail_url
          ?? firstVideo?.thumbnail_url
          ?? (firstYtId ? `https://img.youtube.com/vi/${firstYtId}/mqdefault.jpg` : null),
      }
    })
    // Bo'sh playlist (hali videosi yo'q) foydalanuvchiga ko'rsatilmaydi.
    .filter(p => p.video_count > 0)

  return Response.json({
    videos: standaloneVideos,
    playlists,
    userPremium: isActivePremium(profileRes.data),
  })
}
