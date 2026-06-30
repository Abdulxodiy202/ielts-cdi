'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Lock } from 'lucide-react'

interface VideoLesson {
  id: string
  title: string
  description: string | null
  video_url: string
  thumbnail_url: string | null
  category: string
  duration_minutes: number | null
  is_premium: boolean
}

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

export default function VideoDetailPage() {
  const router = useRouter()
  const { id }  = useParams<{ id: string }>()
  const [video,       setVideo]       = useState<VideoLesson | null>(null)
  const [userPremium, setUserPremium] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/video-lessons/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); setLoading(false); return null } return r.json() })
      .then(d => {
        if (!d) return
        setVideo(d.video ?? null)
        setUserPremium(d.userPremium ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="rounded-2xl animate-pulse" style={{ paddingTop: '56.25%', background: 'var(--bg-card)', border: '1px solid var(--border)' }} />
    </div>
  )

  if (notFound || !video) return (
    <div className="p-8 text-center">
      <p className="text-lg mb-4" style={{ color: 'var(--text-muted)' }}>Video topilmadi</p>
      <button onClick={() => router.push('/vocabulary/video-lessons')} className="btn-primary text-sm">
        ← Orqaga qaytish
      </button>
    </div>
  )

  const ytId   = getYouTubeId(video.video_url)
  const locked = video.is_premium && !userPremium
  const cc     = CAT_COLORS[video.category] ?? CAT_COLORS.general

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">

      {/* Back */}
      <div className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        <Link href="/vocabulary" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Lug&apos;at</Link>
        <span>/</span>
        <Link href="/vocabulary/video-lessons" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Video darslar</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }} className="truncate max-w-[200px]">{video.title}</span>
      </div>
      <button onClick={() => router.push('/vocabulary/video-lessons')}
        className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-muted)' }}>
        <ChevronLeft size={16} /> Video darslarga qaytish
      </button>

      {/* Video player */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 16, overflow: 'hidden', background: '#000', marginBottom: 24 }}>
        {locked ? (
          /* Premium lock overlay */
          <>
            {(video.thumbnail_url || ytId) && (
              <img
                src={video.thumbnail_url ?? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
                alt={video.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.35)' }}
              />
            )}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={28} style={{ color: '#f59e0b' }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg mb-1" style={{ color: '#fff' }}>Premium kontent</p>
                <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>Bu video faqat premium foydalanuvchilar uchun</p>
              </div>
              <Link href="/premium"
                className="px-6 py-2.5 rounded-full font-semibold text-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', textDecoration: 'none' }}>
                👑 Premiumga o&apos;tish
              </Link>
            </div>
          </>
        ) : ytId ? (
          <iframe
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={video.title}
          />
        ) : (
          <video
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            src={video.video_url}
            controls
            poster={video.thumbnail_url ?? undefined}
          />
        )}
      </div>

      {/* Meta */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {video.title}
          </h1>
          {video.is_premium && (
            <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              👑 Premium
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: cc.bg, color: cc.color }}>
            {video.category}
          </span>
          {video.duration_minutes && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ⏱ {video.duration_minutes} daqiqa
            </span>
          )}
        </div>

        {video.description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {video.description}
          </p>
        )}
      </div>
    </div>
  )
}
