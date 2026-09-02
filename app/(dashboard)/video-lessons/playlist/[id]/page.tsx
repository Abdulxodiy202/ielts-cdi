'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Lock, Play, ListVideo } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type VideoCategory = 'ielts' | 'self_improvement'

interface PlaylistVideo {
  id: string
  title: string
  video_url: string
  video_source: 'youtube' | 'upload' | null
  thumbnail_url: string | null
  recommendation: string | null
  is_premium: boolean
}

interface PlaylistInfo {
  id: string
  title: string
  description: string | null
  category: VideoCategory | null
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

// Playlist tafsilot sahifasi -- YouTube'dagi playlist sahifasi kabi:
// sarlavha + tavsif, keyin ichidagi videolarning grid ko'rinishi.
// Bosh video-lessons ro'yxatidagi "Playlistlar" filtridan shu yerga
// kelinadi; videoni bosganda oddiy /video-lessons/[id] sahifasiga
// o'tadi (u yerda "Keyingi videolar" panelida shu playlist qatorlari
// avtomatik chiqadi, chunki backend videoning o'z playlist_id'sidan
// aniqlaydi).
export default function PlaylistDetailPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const backTab = searchParams.get('tab') === 'self_improvement' ? 'self_improvement' : 'ielts'

  const [playlist,    setPlaylist]    = useState<PlaylistInfo | null>(null)
  const [videos,      setVideos]      = useState<PlaylistVideo[]>([])
  const [userPremium, setUserPremium] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/video-lessons/playlist/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); setLoading(false); return null } return r.json() })
      .then(d => {
        if (!d) return
        setPlaylist(d.playlist ?? null)
        setVideos(Array.isArray(d.videos) ? d.videos : [])
        setUserPremium(d.userPremium ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (notFound) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg mb-4" style={{ color: 'var(--text-muted)' }}>{t('videoLessons.playlistNotFound')}</p>
        <button onClick={() => router.push('/video-lessons?view=playlists')} className="btn-primary text-sm">{t('videoLessons.backBtn')}</button>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <button
        onClick={() => router.push(`/video-lessons?tab=${backTab}&view=playlists`)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} /> {t('videoLessons.viewPlaylists')}
      </button>

      {loading ? (
        <div className="space-y-2 mb-6">
          <div style={{ height: 24, width: '40%', borderRadius: 6, background: 'var(--bg-secondary)' }} className="animate-pulse" />
          <div style={{ height: 14, width: '60%', borderRadius: 6, background: 'var(--bg-secondary)' }} className="animate-pulse" />
        </div>
      ) : (
        <div className="mb-6 flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <ListVideo size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{playlist?.title}</h1>
            {playlist?.description && (
              <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{playlist.description}</p>
            )}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('videoLessons.videoCount', { count: videos.length })}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ width: '100%', paddingTop: '56.25%', background: 'var(--bg-secondary)' }} />
              <div className="p-4 space-y-2">
                <div style={{ height: 14, borderRadius: 6, background: 'var(--bg-secondary)' }} />
                <div style={{ height: 10, borderRadius: 6, background: 'var(--bg-secondary)', width: '70%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{t('videoLessons.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v, i) => {
            const ytId     = getYouTubeId(v.video_url)
            const thumbSrc = v.thumbnail_url ?? (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)
            const locked   = v.is_premium && !userPremium

            return (
              <div key={v.id}
                className="rounded-2xl overflow-hidden transition-all hover:shadow-lg flex flex-col"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', flexShrink: 0 }}>
                  {thumbSrc ? (
                    <Image
                      src={thumbSrc}
                      alt={v.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      style={{ objectFit: 'cover', filter: locked ? 'blur(3px) brightness(0.5)' : undefined }}
                    />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
                      <Play size={28} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </div>
                  )}
                  {/* Playlistdagi tartib raqami -- YouTube'dagi kabi */}
                  <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    {i + 1}
                  </div>
                  {locked && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={18} style={{ color: '#f59e0b' }} />
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-bold text-sm leading-snug line-clamp-2"
                        style={{ color: 'var(--text-primary)' }}>{v.title}</h3>
                      <span className="flex-shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full"
                        style={v.is_premium
                          ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }
                          : { background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)' }}>
                        {v.is_premium ? `👑 ${t('common.premium')}` : t('common.free')}
                      </span>
                    </div>
                    {v.recommendation && (
                      <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        💡 {v.recommendation}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {locked ? (
                      <Link
                        href={`/video-lessons/${v.id}`}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-sm font-semibold w-full"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                      >
                        <Lock size={14} /> {t('videoLessons.unlockBtn')}
                      </Link>
                    ) : (
                      <Link
                        href={`/video-lessons/${v.id}`}
                        className="pill-glow-accent inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-sm font-semibold w-full"
                      >
                        <Play size={14} /> {t('videoLessons.watchBtn')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
