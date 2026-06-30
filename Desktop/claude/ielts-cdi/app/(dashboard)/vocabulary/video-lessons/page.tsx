'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Lock, Play } from 'lucide-react'

interface VideoLesson {
  id: string
  title: string
  description: string | null
  video_url: string
  thumbnail_url: string | null
  category: string
  duration_minutes: number | null
  is_premium: boolean
  order_index: number
}

const CATEGORIES = ['Barchasi', 'Grammar', 'Vocabulary', 'Speaking', 'Writing', 'Listening', 'Tips']

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  Grammar:    { bg: 'rgba(99,102,241,0.1)',  color: '#6366f1' },
  Vocabulary: { bg: 'rgba(20,184,166,0.1)',  color: '#14b8a6' },
  Speaking:   { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
  Writing:    { bg: 'rgba(139,92,246,0.1)',  color: '#8b5cf6' },
  Listening:  { bg: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  Tips:       { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b' },
  general:    { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:00`
  return `${m}:00`
}

function VideoThumbnail({ video, userPremium }: { video: VideoLesson; userPremium: boolean }) {
  const ytId      = getYouTubeId(video.video_url)
  const thumbSrc  = video.thumbnail_url
    || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)
  const locked    = video.is_premium && !userPremium

  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-secondary)' }}>
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt={video.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: locked ? 'blur(3px) brightness(0.5)' : undefined }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
          <Play size={36} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
      )}

      {/* Duration badge */}
      {video.duration_minutes && (
        <span style={{
          position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(0,0,0,0.75)', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
        }}>
          {formatDuration(video.duration_minutes)}
        </span>
      )}

      {/* Premium overlay */}
      {locked && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Lock size={22} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 8 }}>Premium</span>
        </div>
      )}

      {/* Play button overlay for non-locked */}
      {!locked && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity .2s',
        }} className="play-overlay">
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={18} style={{ color: '#1a1a2e', marginLeft: 2 }} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function VideoLessonsPage() {
  const router = useRouter()
  const [videos,      setVideos]     = useState<VideoLesson[]>([])
  const [userPremium, setUserPremium]= useState(false)
  const [loading,     setLoading]    = useState(true)
  const [catTab,      setCatTab]     = useState('Barchasi')

  useEffect(() => {
    fetch('/api/video-lessons')
      .then(r => r.ok ? r.json() : { videos: [], userPremium: false })
      .then(d => {
        setVideos(Array.isArray(d.videos) ? d.videos : [])
        setUserPremium(d.userPremium ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (catTab === 'Barchasi') return videos
    return videos.filter(v => v.category === catTab)
  }, [videos, catTab])

  return (
    <>
      <style>{`.video-card:hover .play-overlay { opacity: 1 !important; }`}</style>

      <div className="p-6 md:p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            <Link href="/vocabulary" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Lug&apos;at</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)' }}>Video darslar</span>
          </div>
          <button onClick={() => router.push('/vocabulary')}
            className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={16} /> Lug&apos;at ga qaytish
          </button>

          <div className="flex items-start gap-4 mb-5">
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }}>🎬</div>
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Video darslar</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>IELTS bo&apos;yicha video qo&apos;llanmalar va darslar</p>
            </div>
          </div>

          <span className="text-sm font-medium px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Jami: <strong style={{ color: 'var(--text-primary)' }}>{videos.length}</strong> video
          </span>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {CATEGORIES.map(cat => {
            const cc     = cat !== 'Barchasi' ? CAT_COLORS[cat] : null
            const active = catTab === cat
            return (
              <button key={cat} onClick={() => setCatTab(cat)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: active ? (cc?.bg ?? 'var(--accent)') : 'var(--bg-secondary)',
                  color:      active ? (cc?.color ?? '#fff') : 'var(--text-muted)',
                  border:     active ? `1px solid ${cc?.color ?? 'var(--accent)'}` : '1px solid var(--border)',
                }}>
                {cat}
              </button>
            )
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ paddingTop: '56.25%', background: 'var(--bg-secondary)' }} />
                <div className="p-4 space-y-2">
                  <div style={{ height: 14, borderRadius: 6, background: 'var(--bg-secondary)' }} />
                  <div style={{ height: 10, borderRadius: 6, background: 'var(--bg-secondary)', width: '70%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              {videos.length === 0 ? 'Hali video darslar qo\'shilmagan' : 'Bu kategoriyada video topilmadi'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(v => {
              const cc     = CAT_COLORS[v.category] ?? CAT_COLORS.general
              const locked = v.is_premium && !userPremium
              return (
                <div
                  key={v.id}
                  className="video-card rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:scale-[1.01] cursor-pointer"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  onClick={() => router.push(`/vocabulary/video-lessons/${v.id}`)}
                >
                  <VideoThumbnail video={v} userPremium={userPremium} />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-sm leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                        {v.title}
                      </h3>
                      {v.is_premium && (
                        <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                          👑 Premium
                        </span>
                      )}
                    </div>

                    {v.description && (
                      <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>
                        {v.description}
                      </p>
                    )}

                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: cc.bg, color: cc.color }}>
                      {v.category}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
