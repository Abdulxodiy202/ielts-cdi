'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Play, ListVideo } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { StudyPlanBackButton } from '@/components/StudyPlanBackButton'

type VideoCategory = 'ielts' | 'self_improvement'
type ViewMode = 'videos' | 'playlists'

interface VideoLesson {
  id: string
  title: string
  video_url: string
  video_source: 'youtube' | 'upload' | null
  thumbnail_url: string | null
  recommendation: string | null
  is_premium: boolean
  category: VideoCategory | null
}

interface VideoPlaylist {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  category: VideoCategory | null
  video_count: number
}

const TAB_KEY: Record<VideoCategory, string> = {
  ielts: 'videoLessons.ieltsLessons',
  self_improvement: 'videoLessons.selfImprovement',
}

const EMPTY_KEY: Record<VideoCategory, string> = {
  ielts: 'videoLessons.emptyIelts',
  self_improvement: 'videoLessons.emptySelfImprovement',
}

function parseTab(v: string | null): VideoCategory {
  return v === 'self_improvement' ? 'self_improvement' : 'ielts'
}

function parseView(v: string | null): ViewMode {
  return v === 'playlists' ? 'playlists' : 'videos'
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export default function VideoLessonsPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [videos,      setVideos]      = useState<VideoLesson[]>([])
  const [playlists,   setPlaylists]   = useState<VideoPlaylist[]>([])
  const [userPremium, setUserPremium] = useState(false)
  const [loading,     setLoading]     = useState(true)

  const tab  = parseTab(searchParams.get('tab'))
  const view = parseView(searchParams.get('view'))

  const setTab = useCallback((next: VideoCategory) => {
    const p = new URLSearchParams()
    if (next !== 'ielts') p.set('tab', next)
    if (view !== 'videos') p.set('view', view)
    const qs = p.toString()
    router.replace(qs ? `/video-lessons?${qs}` : '/video-lessons', { scroll: false })
  }, [router, view])

  const setView = useCallback((next: ViewMode) => {
    const p = new URLSearchParams()
    if (tab !== 'ielts') p.set('tab', tab)
    if (next !== 'videos') p.set('view', next)
    const qs = p.toString()
    router.replace(qs ? `/video-lessons?${qs}` : '/video-lessons', { scroll: false })
  }, [router, tab])

  useEffect(() => {
    fetch('/api/video-lessons')
      .then(r => r.ok ? r.json() : { videos: [], playlists: [], userPremium: false })
      .then(d => {
        setVideos(Array.isArray(d.videos) ? d.videos : [])
        setPlaylists(Array.isArray(d.playlists) ? d.playlists : [])
        setUserPremium(d.userPremium ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Aktiv tabga tegishli videolar/playlistlar. Backend hech qanday filter
  // yubormaydi -- client'da bir marta ajratamiz. Kategoriya null bo'lsa
  // 'ielts' deb olamiz (eski qatorlar migration'ga qadar).
  const visibleVideos = useMemo(
    () => videos.filter(v => (v.category ?? 'ielts') === tab),
    [videos, tab],
  )
  const visiblePlaylists = useMemo(
    () => playlists.filter(p => (p.category ?? 'ielts') === tab),
    [playlists, tab],
  )

  const isPlaylistsView = view === 'playlists'
  const visibleCount = isPlaylistsView ? visiblePlaylists.length : visibleVideos.length

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <StudyPlanBackButton />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('videoLessons.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('videoLessons.subtitle')}</p>
          {!loading && visibleCount > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {t('videoLessons.totalLabel', { count: visibleCount })}
            </p>
          )}
        </div>
      </div>

      {/* Subcategory tab qatori -- URL query bilan sinxron. Real pill
          buttons (filled background + border) instead of an underlined
          text tab -- the old style read as plain text, not something
          clickable. */}
      <div className="mb-3 flex gap-2 flex-wrap">
        {(['ielts', 'self_improvement'] as VideoCategory[]).map(key => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                color: active ? 'white' : 'var(--text-secondary)',
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              {t(TAB_KEY[key])}
            </button>
          )
        })}
      </div>

      {/* Videolar / Playlistlar filtri -- YouTube kanalidagi kabi ikki
          xil ko'rinish: alohida videolar ro'yxati yoki playlistlar
          to'plami. Playlistga qo'shilgan video shu "Videolar"
          ro'yxatida endi ko'rinmaydi -- u faqat o'z playlisti ichida
          chiqadi. */}
      <div className="mb-6 flex gap-1.5 flex-wrap">
        {([
          { key: 'videos' as ViewMode,    label: t('videoLessons.viewVideos'),    icon: <Play size={13} /> },
          { key: 'playlists' as ViewMode, label: t('videoLessons.viewPlaylists'), icon: <ListVideo size={13} /> },
        ]).map(({ key, label, icon }) => {
          const active = view === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: active ? 'rgba(99,102,241,0.14)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                border: active ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
              }}
            >
              {icon} {label}
            </button>
          )
        })}
      </div>

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
      ) : isPlaylistsView ? (
        visiblePlaylists.length === 0 ? (
          <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-4xl mb-3">📑</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{t('videoLessons.emptyPlaylists')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visiblePlaylists.map(p => (
              <Link
                key={p.id}
                href={`/video-lessons/playlist/${p.id}?tab=${tab}`}
                className="rounded-2xl overflow-hidden transition-all hover:shadow-lg flex flex-col"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                {/* Thumbnail -- YouTube playlist card: stacked-edge
                    effect (two faint layers behind the main image) plus
                    a video-count badge in the corner. */}
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: '6px 4px 0 4px', top: 6, borderRadius: 8, background: 'rgba(0,0,0,0.35)', zIndex: 0 }} />
                  <div style={{ position: 'absolute', inset: '3px 2px 0 2px', top: 3, borderRadius: 9, background: 'rgba(0,0,0,0.45)', zIndex: 1 }} />
                  <div style={{ position: 'absolute', inset: 0, zIndex: 2, borderRadius: '0 0 0 0', overflow: 'hidden' }}>
                    {p.thumbnail_url ? (
                      <Image
                        src={p.thumbnail_url}
                        alt={p.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
                        <ListVideo size={28} style={{ color: 'rgba(255,255,255,0.4)' }} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.55), transparent 45%)' }} />
                    <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                      <ListVideo size={13} /> {p.video_count}
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-4">
                  <h3 className="font-bold text-sm leading-snug line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>{p.title}</h3>
                  {p.description && (
                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{p.description}</p>
                  )}
                  <p className="text-xs font-medium mt-2" style={{ color: 'var(--accent)' }}>
                    {t('videoLessons.videoCount', { count: p.video_count })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )
      ) : visibleVideos.length === 0 ? (
        <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{t(EMPTY_KEY[tab])}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleVideos.map(v => {
            const ytId     = getYouTubeId(v.video_url)
            const thumbSrc = v.thumbnail_url ?? (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)
            const locked   = v.is_premium && !userPremium

            return (
              // Card no longer a link. Watch is the only nav affordance so
              // a stray click doesn't misfire. Vertical layout (thumb on
              // top, content below) so the card reads correctly inside a
              // narrow grid column.
              <div key={v.id}
                className="rounded-2xl overflow-hidden transition-all hover:shadow-lg flex flex-col"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {/* Thumbnail */}
                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', flexShrink: 0 }}>
                  {thumbSrc ? (
                    <Image
                      src={thumbSrc}
                      alt={v.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      style={{ objectFit: 'cover',
                        filter: locked ? 'blur(3px) brightness(0.5)' : undefined }}
                    />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
                      <Play size={28} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </div>
                  )}
                  {locked && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={18} style={{ color: '#f59e0b' }} />
                    </div>
                  )}
                </div>

                {/* Content */}
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
