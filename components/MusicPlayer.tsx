'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, ListMusic, Music, X,
  Volume2, Volume1, VolumeX,
} from 'lucide-react'

interface Track {
  id: string
  title: string
  youtube_url: string
  order_index: number
}

interface Props {
  autoPlay?: boolean
  defaultMinimized?: boolean
}

function getVideoId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
  return m ? m[1] : null
}

// YouTube iframe'ga command yuborish. `enablejsapi=1` bilan URL yaratilgan
// bo'lsa, iframe.contentWindow.postMessage bilan boshqara olamiz. Bu YT
// IFrame Player API'dan foydalanmasdan, standart postMessage protokoli
// orqali ishlaydi -- <script> yuklashga hojat yo'q.
function ytCommand(iframe: HTMLIFrameElement | null, func: string, args: (string | number)[] = []) {
  if (!iframe || !iframe.contentWindow) return
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*',
    )
  } catch {
    /* iframe hali yuklanmagan yoki cross-origin xato -- yutamiz */
  }
}

const PILL_KEYFRAMES = `
@keyframes musicNote {
  0%, 100% { transform: translateY(0) rotate(-6deg); }
  50% { transform: translateY(-3px) rotate(6deg); }
}
`

const VOLUME_KEY = 'musicPlayer.volume'
const STATE_KEY = 'musicPlayer'

export default function MusicPlayer({ autoPlay = false, defaultMinimized = false }: Props) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isMinimized, setIsMinimized] = useState(defaultMinimized)
  const [showPlaylist, setShowPlaylist] = useState(false)

  // Volume state: 0-100. Default 50. localStorage'dan tiklanadi.
  const [volume, setVolume] = useState(50)
  const [previousVolume, setPreviousVolume] = useState(50)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  // Boshlang'ich yuklashda: saqlangan track index + volume tiklanadi.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}')
      if (typeof saved.lastTrackIndex === 'number') setCurrentIndex(saved.lastTrackIndex)
    } catch { /* noop */ }

    try {
      const savedVol = localStorage.getItem(VOLUME_KEY)
      if (savedVol !== null) {
        const n = parseInt(savedVol, 10)
        if (!Number.isNaN(n) && n >= 0 && n <= 100) {
          setVolume(n)
          if (n > 0) setPreviousVolume(n)
        }
      }
    } catch { /* noop */ }
  }, [])

  useEffect(() => {
    fetch('/api/music')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setTracks(data) })
      .catch(() => { /* offline -- player render bo'lmaydi */ })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({ lastTrackIndex: currentIndex }))
    } catch { /* noop */ }
  }, [currentIndex])

  useEffect(() => {
    try { localStorage.setItem(VOLUME_KEY, String(volume)) } catch { /* noop */ }
    // Volume o'zgarganda iframe'ga yuboramiz. iframe hali yuklanmagan
    // bo'lsa, onLoad'da ham yuboriladi (pastdan).
    ytCommand(iframeRef.current, 'setVolume', [volume])
    if (volume > 0) ytCommand(iframeRef.current, 'unMute')
    else ytCommand(iframeRef.current, 'mute')
  }, [volume])

  const next = useCallback(() => {
    setCurrentIndex(i => (i + 1) % tracks.length)
    setIsPlaying(true)
  }, [tracks.length])

  const prev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + tracks.length) % tracks.length)
    setIsPlaying(true)
  }, [tracks.length])

  const selectTrack = useCallback((idx: number) => {
    setCurrentIndex(idx)
    setIsPlaying(true)
    setShowPlaylist(false)
  }, [])

  const handleVolumeInput = (v: number) => {
    setVolume(v)
    if (v > 0) setPreviousVolume(v)
  }

  const toggleMute = () => {
    if (volume === 0) {
      // Unmute -- oldingi qiymatga qaytamiz (yoki minimum 30 agar juda past bo'lgan)
      setVolume(previousVolume > 0 ? previousVolume : 50)
    } else {
      setPreviousVolume(volume)
      setVolume(0)
    }
  }

  if (tracks.length === 0) return null

  const track = tracks[currentIndex]
  const videoId = getVideoId(track?.youtube_url ?? '')

  // MUHIM: `mute=1` -- browser autoplay policy sabab. User ovoz sozlagichini
  // suurganda unMute() postMessage bilan yuboriladi. Bu YT'ning default
  // autoplay xatti-harakati -- keng qo'llaniladigan naqsh.
  //
  // `enablejsapi=1` -- postMessage command'lar ishlashi uchun majburiy.
  //
  // origin: current page origin -- xavfsizlik uchun YouTube ijozat beradi.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const embedSrc = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?` + new URLSearchParams({
        autoplay: isPlaying ? '1' : '0',
        controls: '0',
        loop: '1',
        playlist: videoId,
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
        enablejsapi: '1',
        // Boshlang'ich mute -- brauzer autoplay policy'sini chetlab o'tamiz.
        // Volume >0 bo'lsa `useEffect` yuqorida darrov `unMute` yuboradi.
        mute: '1',
        origin,
      }).toString()
    : null

  const truncTitle = track?.title
    ? (track.title.length > 15 ? track.title.slice(0, 15) + '…' : track.title)
    : 'Musiqa'

  // key changes on every play/pause or track change → iframe remounts
  const iframeKey = `${currentIndex}-${isPlaying ? 'play' : 'pause'}`

  const handleIframeLoad = () => {
    // iframe yuklangach volume/mute holatini sinxronlaymiz. YT player
    // command'ni birinchi frame'ga cheklovsiz qabul qiladi.
    if (volume > 0) {
      ytCommand(iframeRef.current, 'unMute')
      ytCommand(iframeRef.current, 'setVolume', [volume])
    } else {
      ytCommand(iframeRef.current, 'mute')
    }
    if (isPlaying) {
      ytCommand(iframeRef.current, 'playVideo')
    }
  }

  const hiddenIframe = embedSrc ? (
    <iframe
      key={iframeKey}
      ref={iframeRef}
      src={embedSrc}
      allow="autoplay; encrypted-media"
      onLoad={handleIframeLoad}
      style={{
        position: 'fixed', width: 1, height: 1, opacity: 0,
        pointerEvents: 'none', top: -9999, left: -9999,
      }}
      title="music"
    />
  ) : null

  // Dynamic speaker icon: 0 → mute, <50 → past, >=50 → yuqori
  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2

  if (isMinimized) {
    return (
      <>
        <style>{PILL_KEYFRAMES}</style>
        {hiddenIframe}
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 300,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 12px', width: 180, height: 40,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 24, color: 'white', cursor: 'pointer',
          }}
          title={track?.title}
        >
          <span style={{
            fontSize: 18, flexShrink: 0, display: 'inline-block',
            animation: isPlaying ? 'musicNote 1.2s ease-in-out infinite' : 'none',
          }}>♪</span>
          <span style={{
            fontSize: 12, fontWeight: 500, flex: 1, textAlign: 'left',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {truncTitle}
          </span>
        </button>
      </>
    )
  }

  return (
    <>
      {hiddenIframe}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 300,
        width: 300, borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 8px' }}>
          <Music size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{
            fontSize: 12, fontWeight: 600, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: 'var(--text-primary)',
          }} title={track?.title}>
            {track?.title ?? 'Musiqa'}
          </span>
          <button
            onClick={() => setShowPlaylist(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: showPlaylist ? 'var(--accent)' : 'var(--text-muted)' }}
            title="Playlist"
          >
            <ListMusic size={13} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
            title="Kichraytirish"
          >
            <X size={13} />
          </button>
        </div>

        {/* Play controls */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '8px 12px 10px' }}>
          <button
            onClick={prev}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={() => setIsPlaying(p => !p)}
            style={{
              background: 'var(--accent)', border: 'none', cursor: 'pointer',
              color: 'white', width: 40, height: 40, borderRadius: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>
          <button
            onClick={next}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Volume slider -- expanded rejim'da faqat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px 14px' }}>
          <button
            type="button"
            onClick={toggleMute}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 2,
              color: volume === 0 ? '#ef4444' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={volume === 0 ? "Ovozni yoqish" : "Ovozni o'chirish"}
            aria-label={volume === 0 ? "Ovozni yoqish" : "Ovozni o'chirish"}
          >
            <VolumeIcon size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={e => handleVolumeInput(Number(e.target.value))}
            aria-label="Ovoz"
            style={{
              flex: 1,
              accentColor: 'var(--accent)',
              cursor: 'pointer',
            }}
          />
          <span style={{
            fontSize: 11, fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-muted)', width: 26, textAlign: 'right',
          }}>
            {volume}
          </span>
        </div>

        {/* Playlist */}
        {showPlaylist && (
          <div style={{ borderTop: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto' }}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', color: 'var(--text-muted)' }}>
              Musiqa ro&apos;yxati
            </p>
            {tracks.map((t, i) => (
              <button
                key={t.id}
                onClick={() => selectTrack(i)}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: i === currentIndex ? 'var(--bg-secondary)' : 'transparent',
                  border: 'none', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 12, flexShrink: 0, color: i === currentIndex ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {i === currentIndex && isPlaying ? '▶' : i + 1}
                </span>
                <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: i === currentIndex ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {t.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
