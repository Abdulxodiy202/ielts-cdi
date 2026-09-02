'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { ChevronLeft, Lock, ListVideo, Play } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// PaymentModal only opens when a locked-video user clicks the upgrade CTA.
// Dynamic import keeps it out of the initial video-page bundle.
const PaymentModal = dynamic(() => import('@/components/PaymentModal').then(m => ({ default: m.PaymentModal })), { ssr: false })

interface VideoLesson {
  id: string
  title: string
  video_url: string
  video_source: 'youtube' | 'upload' | null
  thumbnail_url: string | null
  recommendation: string | null
  is_premium: boolean
  playlist_id: string | null
}

interface PlaylistRef {
  id: string
  title: string
}

interface PlaylistSibling {
  id: string
  title: string
  thumbnail_url: string | null
  video_url: string
  video_source: 'youtube' | 'upload' | null
  is_premium: boolean
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

export default function VideoDetailPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const [video,           setVideo]           = useState<VideoLesson | null>(null)
  const [playlist,        setPlaylist]        = useState<PlaylistRef | null>(null)
  const [playlistVideos,  setPlaylistVideos]  = useState<PlaylistSibling[]>([])
  const [userPremium,     setUserPremium]     = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [notFound,        setNotFound]        = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasAutoFullscreened, setHasAutoFullscreened] = useState(false)

  // Browsers block requestFullscreen() without a user gesture, and the
  // <video> below autoplays — so the first `play` event usually has no
  // gesture behind it and the request is silently rejected. Only latch
  // hasAutoFullscreened on SUCCESS, so the next genuine user-initiated
  // play (e.g. clicking the native play button after a pause) still
  // triggers fullscreen instead of being permanently skipped.
  const handlePlay = async () => {
    if (hasAutoFullscreened) return
    const el = videoRef.current
    if (!el) return
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen()
      } else if ((el as any).webkitEnterFullscreen) {
        // iOS Safari
        ;(el as any).webkitEnterFullscreen()
      } else if ((el as any).msRequestFullscreen) {
        await (el as any).msRequestFullscreen()
      } else {
        return
      }
      setHasAutoFullscreened(true)
    } catch (err) {
      // Fullscreen blocked (e.g. no user gesture yet) — leave the flag
      // false so we retry on the next play.
      console.log('Fullscreen request failed:', err)
    }
  }

  useEffect(() => {
    if (!id) return
    // Playlist ichida "Keyingi videolar" panelidan boshqa videoga
    // o'tilganda ham AYNAN shu route komponenti qayta ishlatiladi
    // (faqat [id] segmenti o'zgaradi) -- shu sabab har bir yangi id
    // uchun barcha holatni qo'lda reset qilamiz, aks holda eski
    // video/hasAutoFullscreened qoldiqlari yangi videoga o'tib qoladi.
    setLoading(true)
    setNotFound(false)
    setVideo(null)
    setPlaylist(null)
    setPlaylistVideos([])
    setHasAutoFullscreened(false)
    setShowPaymentModal(false)

    fetch(`/api/video-lessons/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); setLoading(false); return null } return r.json() })
      .then(d => {
        if (!d) return
        setVideo(d.video ?? null)
        setUserPremium(d.userPremium ?? false)
        setPlaylist(d.playlist ?? null)
        setPlaylistVideos(Array.isArray(d.playlistVideos) ? d.playlistVideos : [])
        setLoading(false)
      })
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
      <p className="text-lg mb-4" style={{ color: 'var(--text-muted)' }}>{t('videoLessons.notFound')}</p>
      <button onClick={() => router.push('/video-lessons')} className="btn-primary text-sm">{t('videoLessons.backBtn')}</button>
    </div>
  )

  const ytId    = getYouTubeId(video.video_url)
  const locked  = video.is_premium && !userPremium
  const thumbSrc = video.thumbnail_url ?? (ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : null)

  // YouTube-nocookie embed with every branding-suppression flag Google
  // still honors: no related videos, modest branding, hide old
  // title/uploader chrome, no annotations, keep controls + fullscreen.
  // `origin` gates postMessage security for the embed. `typeof window`
  // guard is belt-and-suspenders (the file is `use client` and this only
  // runs after `loading` flips false, but a stray SSR path would crash
  // without it).
  const ytEmbedUrl = ytId
    ? `https://www.youtube-nocookie.com/embed/${ytId}?` + new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        showinfo: '0',
        iv_load_policy: '3',
        fs: '1',
        cc_load_policy: '0',
        disablekb: '0',
        playsinline: '1',
        controls: '1',
        autoplay: '1',
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      }).toString()
    : null

  const hasPlaylistPanel = !!playlist && playlistVideos.length > 1
  const backHref = playlist ? `/video-lessons/playlist/${playlist.id}` : '/video-lessons'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
        <button onClick={() => router.push(backHref)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 8px', borderRadius: 8, transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}>
          <ChevronLeft size={18} />
          <span className="font-medium truncate max-w-xs">{video.title}</span>
        </button>
      </div>

      {/* Video + (agar playlist ichida bo'lsa) "Keyingi videolar" paneli --
          YouTube'dagi "Up next" ro'yxatiga o'xshab. Mobil'da panel video
          ostiga tushadi (flex-col), desktop'da o'ngga (lg:flex-row). */}
      <div className="flex flex-col lg:flex-row" style={{ flex: 1, minHeight: 0, overflow: hasPlaylistPanel ? 'auto' : 'hidden' }}>
        <div style={{ position: 'relative', flex: 1, minHeight: hasPlaylistPanel ? '56.25vw' : undefined, maxHeight: hasPlaylistPanel ? '70vh' : undefined, overflow: 'hidden' }}
          className={hasPlaylistPanel ? 'lg:max-h-none' : ''}>
          {locked ? (
            <>
              {thumbSrc && (
                <Image
                  src={thumbSrc}
                  alt={video.title}
                  fill
                  sizes="100vw"
                  priority
                  style={{ objectFit: 'cover', filter: 'blur(10px) brightness(0.25)' }}
                />
              )}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={32} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 8 }}>{t('videoLessons.premiumLockTitle')}</p>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 24 }}>{t('videoLessons.premiumLockDesc')}</p>
                </div>
                <button onClick={() => setShowPaymentModal(true)}
                  style={{ padding: '12px 28px', borderRadius: 50, fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-block', transition: 'opacity .15s' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.opacity = '1')}>
                  {t('videoLessons.upgradeBtn')}
                </button>
                {video.recommendation && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
                    💡 {video.recommendation}
                  </p>
                )}
              </div>
            </>
          ) : (video.video_source === 'upload' || (!ytId && video.video_url)) ? (
            <video
              ref={videoRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              src={video.video_url}
              poster={video.thumbnail_url ?? undefined}
              controls autoPlay
              onPlay={handlePlay}
            />
          ) : ytId && ytEmbedUrl ? (
            <iframe
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              src={ytEmbedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          ) : null}
        </div>

        {hasPlaylistPanel && (
          <aside
            style={{
              width: '100%',
              flexShrink: 0,
              background: 'rgba(255,255,255,0.03)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              overflowY: 'auto',
            }}
            className="lg:w-[360px] lg:border-t-0 lg:border-l"
          >
            <div style={{ padding: '14px 16px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <ListVideo size={13} /> {t('videoLessons.upNext')}
              </div>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 4 }}>{playlist!.title}</p>
            </div>
            <div style={{ padding: '4px 8px 16px' }}>
              {playlistVideos.map((sib, i) => {
                const sibYtId  = getYouTubeId(sib.video_url)
                const sibThumb = sib.thumbnail_url ?? (sibYtId ? `https://img.youtube.com/vi/${sibYtId}/mqdefault.jpg` : null)
                const isActive = sib.id === video.id
                const sibLocked = sib.is_premium && !userPremium
                return (
                  <button
                    key={sib.id}
                    onClick={() => { if (!isActive) router.push(`/video-lessons/${sib.id}`) }}
                    style={{
                      width: '100%', display: 'flex', gap: 10, padding: 8, borderRadius: 10, marginBottom: 2,
                      background: isActive ? 'rgba(99,102,241,0.18)' : 'transparent',
                      border: 'none', cursor: isActive ? 'default' : 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ position: 'relative', width: 120, height: 68, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}>
                      {sibThumb ? (
                        <Image src={sibThumb} alt={sib.title} fill sizes="120px"
                          style={{ objectFit: 'cover', filter: sibLocked ? 'blur(2px) brightness(0.5)' : undefined }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Play size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        </div>
                      )}
                      {sibLocked && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Lock size={13} style={{ color: '#f59e0b' }} />
                        </div>
                      )}
                      <div style={{ position: 'absolute', bottom: 3, left: 4, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '0 4px' }}>
                        {i + 1}
                      </div>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        fontSize: 13, fontWeight: isActive ? 700 : 500, lineHeight: 1.35,
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {sib.title}
                      </p>
                      {isActive && (
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>▶ {t('videoLessons.watchBtn')}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>
        )}
      </div>

      {showPaymentModal && (
        <PaymentModal
          isOpen
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => setShowPaymentModal(false)}
          type="premium"
          amount={50000}
        />
      )}
    </div>
  )
}
