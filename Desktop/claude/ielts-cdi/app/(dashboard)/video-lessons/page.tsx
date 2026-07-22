'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Lock, Play, ClipboardCheck } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { StarsBadge } from '@/components/ui/StarsBadge'
import { SectionStarsChip } from '@/components/ui/SectionStarsChip'
import { StudyPlanBackButton } from '@/components/StudyPlanBackButton'

interface VideoLesson {
  id: string
  title: string
  video_url: string
  video_source: 'youtube' | 'upload' | null
  thumbnail_url: string | null
  recommendation: string | null
  is_premium: boolean
}

interface VideoResult {
  video_id: string
  best_stars: number
  best_score: number
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export default function VideoLessonsPage() {
  const { t } = useLanguage()
  const [videos,      setVideos]      = useState<VideoLesson[]>([])
  const [userPremium, setUserPremium] = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [resultsByVideoId, setResultsByVideoId] = useState<Record<string, VideoResult>>({})

  useEffect(() => {
    fetch('/api/video-lessons')
      .then(r => r.ok ? r.json() : { videos: [], userPremium: false, results: [] })
      .then(d => {
        setVideos(Array.isArray(d.videos) ? d.videos : [])
        setUserPremium(d.userPremium ?? false)
        const rmap: Record<string, VideoResult> = {}
        for (const r of (d.results ?? []) as VideoResult[]) {
          if (r?.video_id) rmap[r.video_id] = r
        }
        setResultsByVideoId(rmap)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const sectionTotal = videos.reduce(
    (sum, v) => sum + (resultsByVideoId[v.id]?.best_stars ?? 0),
    0,
  )
  const maxStars = videos.length * 5

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <StudyPlanBackButton />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('videoLessons.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('videoLessons.subtitle')}</p>
          {!loading && videos.length > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {t('videoLessons.totalLabel', { count: videos.length })}
            </p>
          )}
        </div>
        {!loading && videos.length > 0 && (
          <div className="shrink-0">
            <SectionStarsChip total={sectionTotal} max={maxStars} />
          </div>
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
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{t('videoLessons.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map(v => {
            const ytId     = getYouTubeId(v.video_url)
            const thumbSrc = v.thumbnail_url ?? (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)
            const locked   = v.is_premium && !userPremium
            const bestStars = resultsByVideoId[v.id]?.best_stars ?? 0

            return (
              // Card no longer a link. Watch + Test are the only nav
              // affordances so a stray click doesn't misfire into either.
              <div key={v.id}
                className="rounded-2xl overflow-hidden transition-all hover:shadow-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex gap-0">
                  {/* Thumbnail */}
                  <div style={{ position: 'relative', width: 180, flexShrink: 0 }}>
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                      {thumbSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
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
                      {bestStars > 0 && !locked && (
                        <StarsBadge stars={bestStars} variant="poster" size={16} />
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
                          className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                        >
                          <Lock size={12} /> {t('videoLessons.unlockBtn')}
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/video-lessons/${v.id}`}
                            className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold"
                            style={{ background: 'var(--accent)', color: 'white' }}
                          >
                            <Play size={12} /> {t('videoLessons.watchBtn')}
                          </Link>
                          <Link
                            href={`/video-lessons/${v.id}/test`}
                            className="inline-flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold"
                            style={{ background: '#10b981', color: 'white' }}
                          >
                            <ClipboardCheck size={12} /> {t('videoLessons.takeTest')}
                          </Link>
                        </>
                      )}
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
