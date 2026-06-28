'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, ListMusic, Music, X,
} from 'lucide-react'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady?: () => void
  }
}

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

function extractVideoId(url: string): string | null {
  const patterns = [/[?&]v=([^&#]+)/, /youtu\.be\/([^?&#]+)/, /youtube\.com\/embed\/([^?&#]+)/]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const PILL_KEYFRAMES = `
@keyframes musicNote {
  0%, 100% { transform: translateY(0) rotate(-6deg); }
  50% { transform: translateY(-3px) rotate(6deg); }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`

export function MusicPlayer({ autoPlay = false, defaultMinimized = false }: Props) {
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(50)
  const [isLooping, setIsLooping] = useState(false)
  const [isMinimized, setIsMinimized] = useState(defaultMinimized)
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [autoPlayBlocked, setAutoPlayBlocked] = useState(false)

  const playerRef = useRef<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Always-current refs so event callbacks don't capture stale closures
  const currentIndexRef = useRef(0)
  const isLoopingRef = useRef(false)
  const tracksRef = useRef<Track[]>([])
  const volumeRef = useRef(50)
  const isMutedRef = useRef(false)
  const isPlayingRef = useRef(false)

  currentIndexRef.current = currentIndex
  isLoopingRef.current = isLooping
  tracksRef.current = tracks
  volumeRef.current = volume
  isMutedRef.current = isMuted
  isPlayingRef.current = isPlaying

  // ── Load tracks ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/music')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setTracks(data) })
      .catch(() => {})
  }, [])

  // ── Restore localStorage prefs ─────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('musicPlayer') ?? '{}')
      if (typeof saved.volume === 'number') setVolume(saved.volume)
      if (typeof saved.isMuted === 'boolean') setIsMuted(saved.isMuted)
      if (typeof saved.isLooping === 'boolean') setIsLooping(saved.isLooping)
      if (typeof saved.lastTrackIndex === 'number') setCurrentIndex(saved.lastTrackIndex)
    } catch {}
  }, [])

  // ── Persist prefs ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('musicPlayer', JSON.stringify({
        lastTrackIndex: currentIndex, volume, isMuted, isLooping,
      }))
    } catch {}
  }, [currentIndex, volume, isMuted, isLooping])

  // ── Progress polling ───────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const p = playerRef.current
      if (!p || typeof p.getCurrentTime !== 'function') return
      try {
        const ct = p.getCurrentTime()
        const dur = p.getDuration()
        if (isFinite(ct) && ct >= 0) setCurrentTime(ct)
        if (isFinite(dur) && dur > 0) setDuration(dur)
      } catch {}
    }, 500)
  }, [])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  // ── YT state change handler ────────────────────────────────────────────
  const onStateChange = useCallback((event: any) => {
    const YT = window.YT
    if (!YT) return
    if (event.data === YT.PlayerState.PLAYING) {
      setIsPlaying(true)
      setAutoPlayBlocked(false)
      if (autoPlayTimerRef.current) { clearTimeout(autoPlayTimerRef.current); autoPlayTimerRef.current = null }
      startPolling()
    } else if (event.data === YT.PlayerState.PAUSED) {
      setIsPlaying(false)
      stopPolling()
    } else if (event.data === YT.PlayerState.ENDED) {
      setIsPlaying(false)
      stopPolling()
      setCurrentTime(0)
      if (isLoopingRef.current) {
        playerRef.current?.seekTo(0, true)
        playerRef.current?.playVideo()
      } else {
        const tracks = tracksRef.current
        if (tracks.length === 0) return
        const next = (currentIndexRef.current + 1) % tracks.length
        setCurrentIndex(next)
        const vid = extractVideoId(tracks[next]?.youtube_url ?? '')
        if (vid) playerRef.current?.loadVideoById(vid)
      }
    }
  }, [startPolling, stopPolling])

  // ── Init YouTube IFrame API (once tracks are loaded) ───────────────────
  useEffect(() => {
    if (tracks.length === 0) return
    const shouldAutoPlay = autoPlay

    const initPlayer = () => {
      if (playerRef.current) return
      const videoId = extractVideoId(tracks[currentIndexRef.current]?.youtube_url ?? '') ?? ''
      playerRef.current = new window.YT.Player('yt-player-host', {
        height: '1', width: '1',
        videoId,
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(volumeRef.current)
            if (isMutedRef.current) e.target.mute()
            setPlayerReady(true)
            if (shouldAutoPlay) {
              e.target.playVideo()
              autoPlayTimerRef.current = setTimeout(() => {
                if (!isPlayingRef.current) setAutoPlayBlocked(true)
              }, 1500)
            }
          },
          onStateChange,
        },
      })
    }

    if (window.YT?.Player) {
      initPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { prev?.(); initPlayer() }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    }

    return () => {
      stopPolling()
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length === 0 ? 0 : 1]) // run once when tracks become available

  // ── Controls ──────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!playerRef.current || !playerReady) return
    isPlaying ? playerRef.current.pauseVideo() : playerRef.current.playVideo()
  }, [isPlaying, playerReady])

  const prev = useCallback(() => {
    if (!playerReady || tracks.length === 0) return
    const idx = (currentIndex - 1 + tracks.length) % tracks.length
    setCurrentIndex(idx)
    setCurrentTime(0)
    const vid = extractVideoId(tracks[idx]?.youtube_url ?? '')
    if (vid) playerRef.current?.loadVideoById(vid)
  }, [currentIndex, tracks, playerReady])

  const next = useCallback(() => {
    if (!playerReady || tracks.length === 0) return
    const idx = (currentIndex + 1) % tracks.length
    setCurrentIndex(idx)
    setCurrentTime(0)
    const vid = extractVideoId(tracks[idx]?.youtube_url ?? '')
    if (vid) playerRef.current?.loadVideoById(vid)
  }, [currentIndex, tracks, playerReady])

  const selectTrack = useCallback((idx: number) => {
    if (!playerReady) return
    setCurrentIndex(idx)
    setCurrentTime(0)
    const vid = extractVideoId(tracks[idx]?.youtube_url ?? '')
    if (vid) playerRef.current?.loadVideoById(vid)
    setShowPlaylist(false)
  }, [tracks, playerReady])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const t = pct * duration
    playerRef.current.seekTo(t, true)
    setCurrentTime(t)
  }, [duration])

  const changeVolume = useCallback((val: number) => {
    setVolume(val)
    if (playerRef.current) {
      playerRef.current.setVolume(val)
      if (val > 0 && isMuted) {
        setIsMuted(false)
        playerRef.current.unMute()
      }
    }
  }, [isMuted])

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return
    if (isMuted) {
      setIsMuted(false)
      playerRef.current.unMute()
      playerRef.current.setVolume(volume || 50)
    } else {
      setIsMuted(true)
      playerRef.current.mute()
    }
  }, [isMuted, volume])

  if (tracks.length === 0) return null

  const track = tracks[currentIndex]
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const truncTitle = track?.title
    ? (track.title.length > 15 ? track.title.slice(0, 15) + '…' : track.title)
    : 'Musiqa'

  // ── Minimized pill ────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <>
        <style>{PILL_KEYFRAMES}</style>
        <div id="yt-player-host" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: -9999 }} />
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 z-[300] flex items-center gap-2 px-3 rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95"
          style={{
            width: 180, height: 40,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'white',
          }}
          title={track?.title}
        >
          <span
            className="text-base shrink-0"
            style={{
              display: 'inline-block',
              animation: autoPlayBlocked
                ? 'blink 0.8s step-end infinite'
                : isPlaying
                  ? 'musicNote 1.2s ease-in-out infinite'
                  : 'none',
            }}
          >
            {autoPlayBlocked ? '▶' : '♪'}
          </span>
          <span
            className="text-xs font-medium flex-1 text-left"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}
          >
            {truncTitle}
          </span>
        </button>
      </>
    )
  }

  // ── Full player ───────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden YouTube player host */}
      <div id="yt-player-host" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: -9999 }} />

      {/* Player card */}
      <div
        className="fixed bottom-6 right-6 z-[300] rounded-2xl shadow-2xl overflow-hidden"
        style={{
          width: 280,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <Music size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }} title={track?.title}>
            {track?.title ?? 'Musiqa'}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowPlaylist(v => !v)}
              title="Playlist"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: showPlaylist ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <ListMusic size={13} />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              title="Kichraytirish"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Time */}
        <div className="flex justify-between px-3 pb-1">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtTime(currentTime)}</span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtTime(duration)}</span>
        </div>

        {/* Progress bar */}
        <div
          className="mx-3 mb-2 h-1.5 rounded-full cursor-pointer relative"
          style={{ background: 'var(--bg-secondary)' }}
          onClick={seek}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 px-3 pb-2">
          <button
            onClick={() => setIsLooping(v => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-opacity"
            style={{ color: isLooping ? 'var(--accent)' : 'var(--text-muted)', opacity: isLooping ? 1 : 0.5 }}
            title={isLooping ? 'Loop yoqilgan' : 'Loop o\'chirish'}
          >
            <Repeat size={13} />
          </button>
          <button
            onClick={prev}
            disabled={!playerReady}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            disabled={!playerReady}
            className="w-10 h-10 flex items-center justify-center rounded-full shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>
          <button
            onClick={next}
            disabled={!playerReady}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity disabled:opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          >
            <SkipForward size={16} />
          </button>
          <button
            onClick={toggleMute}
            disabled={!playerReady}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity disabled:opacity-30"
            style={{ color: 'var(--text-muted)' }}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <VolumeX size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={e => changeVolume(Number(e.target.value))}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'var(--accent)' }}
          />
          <Volume2 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>

        {/* Playlist dropdown */}
        {showPlaylist && (
          <div
            className="border-t"
            style={{ borderColor: 'var(--border)', maxHeight: 200, overflowY: 'auto' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide px-3 py-2" style={{ color: 'var(--text-muted)' }}>
              Musiqa ro&apos;yxati
            </p>
            {tracks.map((t, i) => (
              <button
                key={t.id}
                onClick={() => selectTrack(i)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ background: i === currentIndex ? 'var(--bg-secondary)' : 'transparent' }}
              >
                {i === currentIndex && isPlaying ? (
                  <span className="text-xs shrink-0" style={{ color: 'var(--accent)' }}>▶</span>
                ) : (
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                )}
                <span className="text-xs truncate" style={{ color: i === currentIndex ? 'var(--accent)' : 'var(--text-primary)' }}>
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
