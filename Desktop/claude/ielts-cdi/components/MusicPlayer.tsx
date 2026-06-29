'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, ListMusic, Music, X } from 'lucide-react'

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

const PILL_KEYFRAMES = `
@keyframes musicNote {
  0%, 100% { transform: translateY(0) rotate(-6deg); }
  50% { transform: translateY(-3px) rotate(6deg); }
}
`

export default function MusicPlayer({ autoPlay = false, defaultMinimized = false }: Props) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [isMinimized, setIsMinimized] = useState(defaultMinimized)
  const [showPlaylist, setShowPlaylist] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('musicPlayer') ?? '{}')
      if (typeof saved.lastTrackIndex === 'number') setCurrentIndex(saved.lastTrackIndex)
    } catch {}
  }, [])

  useEffect(() => {
    fetch('/api/music')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setTracks(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    try { localStorage.setItem('musicPlayer', JSON.stringify({ lastTrackIndex: currentIndex })) } catch {}
  }, [currentIndex])

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

  if (tracks.length === 0) return null

  const track = tracks[currentIndex]
  const videoId = getVideoId(track?.youtube_url ?? '')
  const embedSrc = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&controls=0&loop=1&playlist=${videoId}&rel=0&modestbranding=1&playsinline=1`
    : null

  const truncTitle = track?.title
    ? (track.title.length > 15 ? track.title.slice(0, 15) + '…' : track.title)
    : 'Musiqa'

  // key changes on every play/pause or track change → iframe remounts with new src
  const iframeKey = `${currentIndex}-${isPlaying ? 'play' : 'pause'}`

  const hiddenIframe = embedSrc ? (
    <iframe
      key={iframeKey}
      src={embedSrc}
      allow="autoplay; encrypted-media"
      style={{
        position: 'fixed', width: 1, height: 1, opacity: 0,
        pointerEvents: 'none', top: -9999, left: -9999,
      }}
      title="music"
    />
  ) : null

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
            WebkitBackdropFilter: 'blur(12px)' as any,
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
        width: 280, borderRadius: 16, overflow: 'hidden',
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

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '8px 12px 14px' }}>
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
