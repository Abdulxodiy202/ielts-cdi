'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Play } from 'lucide-react'

interface VideoLesson {
  id: string
  title: string
  video_url: string
  recommendation: string | null
  is_premium: boolean
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export default function VideoLessonsPage() {
  const router = useRouter()
  const [videos,      setVideos]      = useState<VideoLesson[]>([])
  const [userPremium, setUserPremium] = useState(false)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/video-lessons')
      .then(r => r.ok ? r.json() : { videos: [], userPremium: false })
      .then(d => { setVideos(Array.isArray(d.videos) ? d.videos : []); setUserPremium(d.userPremium ?? false); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>🎬 Video darslar</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>IELTS bo&apos;yicha video qo&apos;llanmalar va darslar</p>
        {!loading && videos.length > 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Jami: <strong style={{ color: 'var(--text-primary)' }}>{videos.length}</strong> video
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden animate-pulse flex gap-4 p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ width: 160, height: 90, borderRadius: 10, background: 'var(--bg-secondary)', flexShrink: 0 }} />
              <div className="flex-1 space-y-2 py-1">
                <div style={{ height: 14, borderRadius: 6, background: 'var(--bg-secondary)' }} />
                <div style={{ height: 10, borderRadius: 6, background: 'var(--bg-secondary)', width: '70%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Hali video darslar qo&apos;shilmagan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map(v => {
            const ytId     = getYouTubeId(v.video_url)
            const thumbSrc = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null
            const locked   = v.is_premium && !userPremium

            return (
              <div key={v.id}
                className="group rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                onClick={() => router.push(`/video-lessons/${v.id}`)}>
                <div className="flex gap-0">
                  {/* Thumbnail */}
                  <div style={{ position: 'relative', width: 180, flexShrink: 0 }}>
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                      {thumbSrc ? (
                        <img src={thumbSrc} alt={v.title}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                            filter: locked ? 'blur(3px) brightness(0.5)' : undefined }} />
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
                      {!locked && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'opacity .2s' }}
                          className="group-hover:!opacity-100">
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Play size={14} style={{ color: '#1a1a2e', marginLeft: 2 }} />
                          </div>
                        </div>
                      )}
                    </div>
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
                          {v.is_premium ? '👑 Premium' : 'Bepul'}
                        </span>
                      </div>
                      {v.recommendation && (
                        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          💡 {v.recommendation}
                        </p>
                      )}
                    </div>
                    <div className="mt-3">
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                        Ko&apos;rish →
                      </span>
                    </div>
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
