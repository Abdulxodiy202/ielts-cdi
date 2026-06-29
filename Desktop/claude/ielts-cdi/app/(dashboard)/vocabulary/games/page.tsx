'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/* ── Types ────────────────────────────────────────────────────────── */
interface Level {
  level_number: number
  title: string
  difficulty: string
  status: 'completed' | 'current' | 'locked'
  score: number
  max_score: number
}

/* ── Layout constants ─────────────────────────────────────────────── */
const COLS = 5
const ROWS = 20
const SW   = 56     // stone width/height
const BR   = 14     // border-radius
const CSP  = 86     // col spacing center-to-center
const RSP  = 96     // row spacing
const PX   = 52     // padding to first stone center
const PY   = 72

const CW = PX * 2 + (COLS - 1) * CSP   // 448
const CH = PY * 2 + (ROWS - 1) * RSP + SW  // 2024

const MILESTONES: Record<number, string> = { 10: '🌟', 20: '🏆', 50: '💎', 100: '👑' }

/* ── Position (level 1 at bottom) ────────────────────────────────── */
function stonePos(n: number) {
  const idx  = n - 1
  const row  = Math.floor(idx / COLS)
  const col  = idx % COLS
  const vRow = ROWS - 1 - row
  const x    = vRow % 2 === 1
    ? PX + (COLS - 1 - col) * CSP
    : PX + col * CSP
  return { x, y: PY + vRow * RSP }
}

const ALL_PTS = Array.from({ length: 100 }, (_, i) => stonePos(i + 1))

/* Build curved snake path — bezier at row wraps */
function buildPath(pts: { x: number; y: number }[]): string {
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    if (i % COLS === 0) {
      const vRow0 = ROWS - 1 - Math.floor((i - 1) / COLS)
      const bump  = vRow0 % 2 === 1 ? -36 : 36
      const midY  = (p0.y + p1.y) / 2
      d += ` Q${p0.x + bump},${midY} ${p1.x},${p1.y}`
    } else {
      d += ` L${p1.x},${p1.y}`
    }
  }
  return d
}

const FULL_D = buildPath(ALL_PTS)

/* ── CSS ──────────────────────────────────────────────────────────── */
const CSS = `
@keyframes studentBounce {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-5px); }
}
@keyframes nodeGlow {
  0%,100% { box-shadow: 0 0 0 4px rgba(99,102,241,.28), 0 4px 20px rgba(99,102,241,.5); }
  50%     { box-shadow: 0 0 0 10px rgba(99,102,241,.1), 0 6px 32px rgba(99,102,241,.8); }
}
@keyframes twinkle {
  0%,100% { opacity: .25; transform: scale(1); }
  50%      { opacity: .9;  transform: scale(1.4); }
}
`

/* ── Main component ───────────────────────────────────────────────── */
export default function GamesPage() {
  const [levels, setLevels]   = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [stars, setStars]     = useState<{ id: number; x: number; y: number; r: number; dur: string; del: string }[]>([])
  const router     = useRouter()
  const currentRef = useRef<HTMLDivElement | null>(null)

  /* Stars — client-only (avoid SSR mismatch) */
  useEffect(() => {
    setStars(Array.from({ length: 90 }, (_, i) => ({
      id: i,
      x:   Math.random() * 100,
      y:   Math.random() * 100,
      r:   Math.random() < 0.18 ? 1.5 : 0.8,
      dur: (1.8 + Math.random() * 3).toFixed(1) + 's',
      del: (Math.random() * 3).toFixed(1) + 's',
    })))
  }, [])

  /* Levels */
  useEffect(() => {
    fetch('/api/game/levels')
      .then(r => r.json())
      .then((d: Level[]) => { setLevels(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  /* Scroll to current */
  useEffect(() => {
    if (!loading && currentRef.current) {
      setTimeout(() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
    }
  }, [loading])

  const lvlMap = useMemo(() => new Map(levels.map(l => [l.level_number, l])), [levels])
  const doneN  = levels.filter(l => l.status === 'completed').length
  const curN   = levels.find(l => l.status === 'current')?.level_number ?? 1
  const curPos = stonePos(curN)

  /* Green completed segment */
  const greenD = useMemo(() => {
    if (doneN < 2) return ''
    const pts = Array.from({ length: doneN }, (_, i) => stonePos(i + 1))
    return buildPath(pts)
  }, [doneN])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{
        position: 'relative',
        minHeight: CH + 120,
        background: 'linear-gradient(170deg, #0c0c1d 0%, #0f0f1a 35%, #10101e 70%, #0a0a14 100%)',
        overflowX: 'hidden',
      }}>

        {/* ── Star field ─── */}
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute',
            left: `${s.x}%`,
            top:  `${s.y * (CH / 100)}px`,
            width:  s.r * 2, height: s.r * 2, borderRadius: '50%',
            background: '#fff',
            animation: `twinkle ${s.dur} ease-in-out ${s.del} infinite`,
            pointerEvents: 'none', zIndex: 0,
          }} />
        ))}

        {/* ── Sticky header ─── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'rgba(8,8,20,0.88)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
        }}>
          <Link href="/vocabulary" style={{
            color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
            fontWeight: 700, fontSize: 13,
          }}>
            ← Lug'at
          </Link>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-.3px' }}>
            🎮 So'z O'yini
          </span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 10, padding: '5px 12px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
              {doneN}
              <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/100</span>
            </span>
          </div>
        </div>

        {/* ── Canvas ─── */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 28, paddingBottom: 64 }}>
          <div style={{ position: 'relative', width: CW, height: CH, zIndex: 1 }}>

            {/* Subtle geometric accent rings */}
            {[
              { x: -45, y: 220,  s: 140, r: 25, opacity: .06 },
              { x: CW - 95, y: 650,  s: 110, r: 20, opacity: .05 },
              { x: -35, y: 1120, s: 120, r: 22, opacity: .06 },
              { x: CW - 80, y: 1560, s: 95,  r: 18, opacity: .05 },
              { x: 20, y: 1900, s: 100, r: 20, opacity: .04 },
            ].map((g, i) => (
              <div key={i} style={{
                position: 'absolute', left: g.x, top: g.y,
                width: g.s, height: g.s,
                border: `1px solid rgba(99,102,241,${g.opacity})`,
                borderRadius: g.r, pointerEvents: 'none',
                transform: `rotate(${i * 13}deg)`,
              }} />
            ))}

            {/* Faint grid lines */}
            <svg width={CW} height={CH}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <line key={i}
                  x1={0} y1={PY + i * (CH - PY * 2) / 7}
                  x2={CW} y2={PY + i * (CH - PY * 2) / 7}
                  stroke="rgba(99,102,241,0.03)" strokeWidth="1" />
              ))}
            </svg>

            {/* ── SVG Path ─── */}
            <svg width={CW} height={CH}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
              <defs>
                <filter id="glow-green">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Track (full) */}
              <path d={FULL_D} fill="none"
                stroke="rgba(255,255,255,0.05)" strokeWidth={14}
                strokeLinejoin="round" strokeLinecap="round" />
              <path d={FULL_D} fill="none"
                stroke="rgba(255,255,255,0.1)" strokeWidth={2}
                strokeDasharray="5 14"
                strokeLinejoin="round" strokeLinecap="round" />

              {/* Completed segment */}
              {greenD && (
                <>
                  <path d={greenD} fill="none"
                    stroke="rgba(34,197,94,0.22)" strokeWidth={14}
                    strokeLinejoin="round" strokeLinecap="round" />
                  <path d={greenD} fill="none"
                    stroke="#22c55e" strokeWidth={2.5}
                    strokeLinejoin="round" strokeLinecap="round"
                    filter="url(#glow-green)" />
                </>
              )}
            </svg>

            {/* ── Level nodes ─── */}
            {Array.from({ length: 100 }, (_, i) => {
              const n        = i + 1
              const { x, y } = stonePos(n)
              const lvl      = lvlMap.get(n)
              const st       = lvl?.status ?? 'locked'
              const isDone   = st === 'completed'
              const isCur    = st === 'current'
              const isLocked = st === 'locked'
              const ms       = MILESTONES[n]
              const half     = SW / 2

              let bg      = ''
              let bord    = ''
              let shad    = ''
              let anim    = ''
              let opacity = 1

              if (isDone) {
                bg   = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                bord = '2px solid rgba(251,191,36,0.45)'
                shad = '0 2px 16px rgba(34,197,94,0.3)'
              } else if (isCur) {
                bg   = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                bord = '2px solid rgba(129,140,248,0.6)'
                anim = 'nodeGlow 2s ease-in-out infinite'
              } else {
                bg      = '#18182e'
                bord    = '1px solid rgba(255,255,255,0.07)'
                opacity = 0.55
              }

              return (
                <div
                  key={n}
                  ref={isCur ? currentRef : undefined}
                  onClick={() => { if (!isLocked) router.push(`/vocabulary/games/${n}`) }}
                  style={{
                    position: 'absolute',
                    left: x - half, top: y - half,
                    width: SW, height: SW,
                    borderRadius: BR,
                    background: bg, border: bord, boxShadow: shad,
                    animation: anim || undefined,
                    opacity,
                    cursor: isLocked ? 'default' : 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: isCur ? 20 : 10,
                    transition: 'transform .15s, opacity .15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isLocked) {
                      const el = e.currentTarget as HTMLDivElement
                      el.style.transform = 'scale(1.1)'
                      el.style.opacity   = '1'
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'scale(1)'
                    el.style.opacity   = String(opacity)
                  }}
                >
                  {/* Inner content */}
                  {isDone ? (
                    ms
                      ? <span style={{ fontSize: 22, lineHeight: 1 }}>{ms}</span>
                      : <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                          <path d="M1 7L6 12L17 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                  ) : isCur ? (
                    ms
                      ? <span style={{ fontSize: 22, lineHeight: 1 }}>{ms}</span>
                      : <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                          <path d="M1 1L13 8L1 15V1Z" fill="white" />
                        </svg>
                  ) : (
                    ms
                      ? <span style={{ fontSize: 20, opacity: 0.3, lineHeight: 1 }}>{ms}</span>
                      : <svg width="14" height="17" viewBox="0 0 14 17" fill="none">
                          <rect x="1" y="7" width="12" height="9" rx="2" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                          <path d="M4 7V5a3 3 0 0 1 6 0v2" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                  )}

                  {/* Level number above node */}
                  <div style={{
                    position: 'absolute', top: -17,
                    fontSize: 11, fontWeight: 700, letterSpacing: '-.2px',
                    color: isDone ? '#4ade80' : isCur ? '#a5b4fc' : 'rgba(255,255,255,0.2)',
                    textShadow: '0 1px 4px rgba(0,0,0,.95)',
                    whiteSpace: 'nowrap',
                  }}>
                    {n}
                  </div>

                  {/* Score dots for completed */}
                  {isDone && lvl && !ms && (
                    <div style={{
                      position: 'absolute', bottom: -14,
                      display: 'flex', gap: 2,
                    }}>
                      {Array.from({ length: lvl.max_score }, (_, k) => (
                        <div key={k} style={{
                          width: 4, height: 4, borderRadius: '50%',
                          background: k < lvl.score ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* ── Student character ─── */}
            {!loading && (
              <div style={{
                position: 'absolute',
                left: curPos.x - 14,
                top:  curPos.y - SW / 2 - 38,
                fontSize: 24, width: 28, textAlign: 'center', lineHeight: '28px',
                zIndex: 30,
                animation: 'studentBounce .85s ease-in-out infinite',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.8))',
                pointerEvents: 'none',
                transition: 'left .85s cubic-bezier(.4,0,.2,1), top .85s cubic-bezier(.4,0,.2,1)',
              }}>
                🎓
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
