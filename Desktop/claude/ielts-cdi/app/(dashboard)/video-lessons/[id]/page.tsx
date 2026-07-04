'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, Lock } from 'lucide-react'

interface VideoLesson {
  id: string
  title: string
  video_url: string
  video_source: 'youtube' | 'upload' | null
  thumbnail_url: string | null
  recommendation: string | null
  is_premium: boolean
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export default function VideoDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [video,       setVideo]       = useState<VideoLesson | null>(null)
  const [userPremium, setUserPremium] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/video-lessons/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); setLoading(false); return null } return r.json() })
      .then(d => { if (!d) return; setVideo(d.video ?? null); setUserPremium(d.userPremium ?? false); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <div style={{ width: 48, height: 48, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (notFound || !video) return (
    <div className="p-8 text-center">
      <p className="text-lg mb-4" style={{ color: 'var(--text-muted)' }}>Video topilmadi</p>
      <button onClick={() => router.push('/video-lessons')} className="btn-primary text-sm">← Orqaga qaytish</button>
    </div>
  )

  const ytId    = getYouTubeId(video.video_url)
  const locked  = video.is_premium && !userPremium
  const thumbSrc = video.thumbnail_url ?? (ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => router.push('/video-lessons')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 8px', borderRadius: 8, transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}>
          <ChevronLeft size={18} />
          <span className="font-medium truncate max-w-xs">{video.title}</span>
        </button>
      </div>

      {/* Video */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {locked ? (
          <>
            {thumbSrc && (
              <img src={thumbSrc} alt={video.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(10px) brightness(0.25)' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={32} style={{ color: '#f59e0b' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 8 }}>Premium kontent</p>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24 }}>Bu video faqat premium foydalanuvchilar uchun</p>
              </div>
              <Link href="/premium"
                style={{ padding: '12px 28px', borderRadius: 50, fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', textDecoration: 'none', display: 'inline-block', transition: 'opacity .15s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '1')}>
                👑 Premiumga o&apos;tish
              </Link>
              {video.recommendation && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
                  💡 {video.recommendation}
                </p>
              )}
            </div>
          </>
        ) : (video.video_source === 'upload' || (!ytId && video.video_url)) ? (
          <video
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            src={video.video_url}
            poster={video.thumbnail_url ?? undefined}
            controls autoPlay
          />
        ) : ytId ? (
          <iframe
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen title={video.title}
          />
        ) : null}
      </div>
    </div>
  )
}
