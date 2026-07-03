'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TEST_EMAIL = 'abdulxdiymamajonov@gmail.com'

/* ── Types ────────────────────────────────────────────────────────── */
interface Level {
  level_number: number
  title: string
  category: string | null
  status: 'completed' | 'current' | 'locked'
  stars: number
}

/* ── Layout constants ─────────────────────────────────────────────── */
const COLS = 5
const ROWS = 20
const SW   = 96      // normal node size
const MS   = 96      // milestone node size
const BR   = 16      // border-radius
const CSP  = 108     // col spacing center-to-center
const RSP  = 110     // row spacing
const PX   = 62      // horizontal padding to first stone center
const PY   = 88      // vertical padding

const CW = PX * 2 + (COLS - 1) * CSP   // 556
const CH = PY * 2 + (ROWS - 1) * RSP + SW  // 2354

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

/* Build curved snake path */
function buildPath(pts: { x: number; y: number }[]): string {
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    if (i % COLS === 0) {
      const vRow0 = ROWS - 1 - Math.floor((i - 1) / COLS)
      const bump  = vRow0 % 2 === 1 ? -44 : 44
      const midY  = (p0.y + p1.y) / 2
      d += ` Q${p0.x + bump},${midY} ${p1.x},${p1.y}`
    } else {
      d += ` L${p1.x},${p1.y}`
    }
  }
  return d
}

const FULL_D = buildPath(ALL_PTS)

/* ── Category config ──────────────────────────────────────────────── */
const CAT_GRADIENT: Record<string, string> = {
  irregular_verbs: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
  reading_vocab:   'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  linking_words:   'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  writing:         'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  review:          'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
}

const CAT_SHORT: Record<string, string> = {
  irregular_verbs: 'Irreg.',
  reading_vocab:   'Reading',
  linking_words:   'Linking',
  writing:         'Writing',
  review:          'Review',
}

const MILESTONE: Record<number, string> = {
  10: '⭐', 20: '⚡', 30: '🎯', 40: '🚀', 50: '🏆',
  60: '💎', 70: '👑', 80: '🏰', 90: '🌟', 100: '🎓',
}

/* ── CSS animations ───────────────────────────────────────────────── */
const CSS = `
@keyframes studentBounce {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
@keyframes nodeGlow {
  0%,100% { box-shadow: 0 0 0 5px rgba(99,102,241,.22), 0 4px 24px rgba(99,102,241,.55); }
  50%     { box-shadow: 0 0 0 12px rgba(99,102,241,.07), 0 6px 36px rgba(99,102,241,.9); }
}
@keyframes milestoneGlow {
  0%,100% { box-shadow: 0 0 0 4px rgba(245,158,11,.28), 0 4px 24px rgba(245,158,11,.5); }
  50%     { box-shadow: 0 0 0 10px rgba(245,158,11,.08), 0 6px 36px rgba(245,158,11,.85); }
}
@keyframes twinkle {
  0%,100% { opacity: .2; transform: scale(1); }
  50%      { opacity: .85; transform: scale(1.4); }
}
@keyframes milestoneFloat {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
`

/* ── Main component ───────────────────────────────────────────────── */
export default function GamesPage() {
  const [levels,    setLevels]    = useState<Level[]>([])
  const [loading,   setLoading]   = useState(true)
  const [stars,     setStars]     = useState<{ id: number; x: number; y: number; r: number; dur: string; del: string }[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router     = useRouter()
  const currentRef = useRef<HTMLDivElement | null>(null)

  /* Stars — client-only */
  useEffect(() => {
    setStars(Array.from({ length: 90 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      r: Math.random() < 0.18 ? 1.5 : 0.8,
      dur: (1.8 + Math.random() * 3).toFixed(1) + 's',
      del: (Math.random() * 3).toFixed(1) + 's',
    })))
  }, [])

  /* User email — test mode bypass */
  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => setUserEmail(user?.email ?? null))
  }, [])

  /* Levels — sessionStorage 30 s cache, bust after level completion */
  useEffect(() => {
    const CACHE_KEY = 'game-levels-v1'
    const TTL = 30_000

    const stale = sessionStorage.getItem('game-levels-stale')
    if (stale) sessionStorage.removeItem('game-levels-stale')

    if (!stale) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY)
        if (raw) {
          const { data, ts } = JSON.parse(raw)
          if (Array.isArray(data) && Date.now() - ts < TTL) {
            setLevels(data)
            setLoading(false)
            return
          }
        }
      } catch {}
    }

    fetch('/api/game/levels')
      .then(r => r.json())
      .then((d: Level[]) => {
        if (Array.isArray(d)) {
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, ts: Date.now() })) } catch {}
          setLevels(d)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  /* Scroll to current */
  useEffect(() => {
    if (!loading && currentRef.current)
      setTimeout(() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [loading])

  const isTestUser = userEmail === TEST_EMAIL

  const lvlMap     = useMemo(() => new Map(levels.map(l => [l.level_number, l])), [levels])
  const doneN      = levels.filter(l => l.status === 'completed').length
  const totalStars = levels.reduce((sum, l) => sum + (l.stars ?? 0), 0)
  const curN       = levels.find(l => l.status === 'current')?.level_number ?? 1
  const curPos = stonePos(curN)

  /* Completed path segment */
  const greenD = useMemo(() => {
    if (doneN < 2) return ''
    return buildPath(Array.from({ length: doneN }, (_, i) => stonePos(i + 1)))
  }, [doneN])

  const half = SW / 2

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div style={{
        position: 'relative', minHeight: CH + 120,
        background: 'linear-gradient(170deg, #0c0c1d 0%, #0f0f1a 35%, #10101e 70%, #0a0a14 100%)',
        overflowX: 'hidden',
      }}>

        {/* Star field */}
        {stars.map(s => (
          <div key={s.id} style={{
            position: 'absolute', left: `${s.x}%`, top: `${s.y * (CH / 100)}px`,
            width: s.r * 2, height: s.r * 2, borderRadius: '50%', background: '#fff',
            animation: `twinkle ${s.dur} ease-in-out ${s.del} infinite`,
            pointerEvents: 'none', zIndex: 0,
          }} />
        ))}

        {/* Sticky header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'rgba(8,8,20,0.88)', backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
        }}>
          <Link href="/vocabulary" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
            ← Lug&apos;at
          </Link>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-.3px' }}>
            🎮 So&apos;z O&apos;yini
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isTestUser && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 8, padding: '4px 8px',
                fontSize: 11, fontWeight: 700, color: 'rgba(167,139,250,0.9)',
                letterSpacing: '.2px',
              }}>
                🔧 Test
              </div>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 10, padding: '5px 10px',
            }}>
              <span style={{ fontSize: 13 }}>⭐</span>
              <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>
                {totalStars}<span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/500</span>
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 10, padding: '5px 12px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                {doneN}<span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/100</span>
              </span>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 28, paddingBottom: 64 }}>
          <div style={{ position: 'relative', width: CW, height: CH, zIndex: 1 }}>

            {/* Geometric accent rings */}
            {[
              { x: -45, y: 220,  s: 140, r: 25, op: .06 },
              { x: CW-95, y: 650,  s: 110, r: 20, op: .05 },
              { x: -35, y: 1120, s: 120, r: 22, op: .06 },
              { x: CW-80, y: 1560, s: 95,  r: 18, op: .05 },
              { x: 20,  y: 1900, s: 100, r: 20, op: .04 },
            ].map((g, i) => (
              <div key={i} style={{
                position: 'absolute', left: g.x, top: g.y, width: g.s, height: g.s,
                border: `1px solid rgba(99,102,241,${g.op})`, borderRadius: g.r,
                pointerEvents: 'none', transform: `rotate(${i * 13}deg)`,
              }} />
            ))}

            {/* Faint grid lines */}
            <svg width={CW} height={CH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <line key={i}
                  x1={0} y1={PY + i * (CH - PY * 2) / 7}
                  x2={CW} y2={PY + i * (CH - PY * 2) / 7}
                  stroke="rgba(99,102,241,0.03)" strokeWidth="1" />
              ))}
            </svg>

            {/* SVG path */}
            <svg width={CW} height={CH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
              <defs>
                <filter id="glow-green">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Locked track — gray dashed */}
              <path d={FULL_D} fill="none"
                stroke="#374151" strokeWidth={14}
                strokeLinejoin="round" strokeLinecap="round" opacity="0.35" />
              <path d={FULL_D} fill="none"
                stroke="#4b5563" strokeWidth={2} strokeDasharray="6 12"
                strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />

              {/* Completed segment — green */}
              {greenD && (
                <>
                  <path d={greenD} fill="none"
                    stroke="rgba(34,197,94,0.18)" strokeWidth={14}
                    strokeLinejoin="round" strokeLinecap="round" />
                  <path d={greenD} fill="none"
                    stroke="#22c55e" strokeWidth={2.5}
                    strokeLinejoin="round" strokeLinecap="round"
                    opacity="0.6" filter="url(#glow-green)" />
                </>
              )}
            </svg>

            {/* Level nodes */}
            {Array.from({ length: 100 }, (_, i) => {
              const n           = i + 1
              const { x, y }   = stonePos(n)
              const lvl         = lvlMap.get(n)
              const st          = lvl?.status ?? 'locked'
              const isDone         = st === 'completed'
              const isCur          = st === 'current'
              const isLocked       = st === 'locked'
              const isTestUnlocked = isTestUser && isLocked   // test bypass: treat as unlocked
              const effectiveLock  = isLocked && !isTestUnlocked
              const cat            = lvl?.category ?? null
              const isMilestone = n % 10 === 0
              const nodeW       = isMilestone ? MS : SW
              const nodeHalf    = nodeW / 2

              const shortCat          = cat ? (CAT_SHORT[cat] ?? cat.slice(0, 8)) : ''
              const lvlStars          = lvl?.stars ?? 0
              const isPerfectMilestone   = isMilestone && isDone && lvlStars === 5
              const isCompletedMilestone = isMilestone && isDone && lvlStars < 5

              /* ── Background & style ─── */
              let bg      = ''
              let bord    = ''
              let shad    = ''
              let anim: string | undefined

              if (isPerfectMilestone) {
                // Case A — transparent; only the giant icon shows
                bg   = 'transparent'
                bord = 'none'
                anim = 'milestoneFloat 3s ease-in-out infinite'
              } else if (isDone) {
                // Case B (completed milestone) + regular completed: same green style
                bg   = cat ? (CAT_GRADIENT[cat] ?? 'linear-gradient(135deg,#22c55e,#16a34a)') : 'linear-gradient(135deg,#22c55e,#16a34a)'
                bord = '2px solid rgba(255,255,255,0.22)'
                shad = '0 2px 12px rgba(0,0,0,0.35)'
              } else if (isCur) {
                bg   = 'linear-gradient(135deg,#6366f1 0%,#7c3aed 100%)'
                bord = '2px solid rgba(129,140,248,0.7)'
                anim = 'nodeGlow 2s ease-in-out infinite'
              } else if (isTestUnlocked) {
                bg   = 'linear-gradient(135deg,#3730a3 0%,#312e81 100%)'
                bord = '1px solid rgba(99,102,241,0.4)'
              } else {
                bg   = isMilestone
                  ? 'linear-gradient(135deg,#2a2a3e 0%,#1a1a2e 100%)'
                  : '#1a1a2e'
                bord = isMilestone ? '2px solid rgba(245,158,11,0.18)' : '1px solid rgba(255,255,255,0.06)'
              }

              const opacity = effectiveLock ? (isMilestone ? 0.6 : 0.5) : 1

              return (
                <div
                  key={n}
                  ref={isCur ? currentRef : undefined}
                  onClick={() => { if (!effectiveLock) router.push(`/vocabulary/games/${n}`) }}
                  style={{
                    position: 'absolute',
                    left: x - nodeHalf,
                    top:  y - nodeHalf,
                    width: nodeW, height: nodeW,
                    borderRadius: (isMilestone && !isDone) ? nodeW / 2 : BR,
                    background: bg, border: bord, boxShadow: shad || undefined,
                    animation: anim,
                    opacity,
                    cursor: effectiveLock ? 'not-allowed' : 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 3,
                    padding: '0 6px',
                    zIndex: isCur ? 20 : isMilestone ? 15 : 10,
                    transition: 'transform .15s, opacity .15s',
                    userSelect: 'none', boxSizing: 'border-box',
                  }}
                  title={isPerfectMilestone ? `Level ${n} — Mukammal!` : undefined}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = effectiveLock ? 'scale(1.02)' : 'scale(1.08)'
                    if (!effectiveLock) {
                      el.style.opacity = '1'
                      router.prefetch(`/vocabulary/games/${n}`)
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'scale(1)'
                    el.style.opacity = String(opacity)
                  }}
                >
                  {/* Floating stars above stone — skip for perfect milestones (giant icon says it all) */}
                  {isDone && lvlStars > 0 && !isPerfectMilestone && (
                    <span style={{
                      position: 'absolute', top: -20, left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 15, lineHeight: 1, letterSpacing: '1px',
                      color: '#fbbf24',
                      textShadow: '0 0 6px rgba(255,200,0,0.7)',
                      whiteSpace: 'nowrap', pointerEvents: 'none',
                    }}>
                      {'★'.repeat(lvlStars)}
                    </span>
                  )}
                  {isPerfectMilestone ? (
                    /* ── Case A: Perfect milestone — giant floating icon ─── */
                    <span style={{
                      fontSize: 60, lineHeight: 1, display: 'block',
                      filter: 'drop-shadow(0 0 8px rgba(255,200,0,0.7))',
                    }}>
                      {MILESTONE[n] ?? '⭐'}
                    </span>
                  ) : isMilestone && !isDone ? (
                    /* ── Case C: Uncompleted milestone — circular stone with icon ─── */
                    <>
                      <span style={{ fontSize: isCur ? 26 : 22, lineHeight: 1, filter: effectiveLock ? 'grayscale(1)' : 'none' }}>
                        {MILESTONE[n] ?? '⭐'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1, color: (isCur || isTestUnlocked) ? '#e0e7ff' : 'rgba(255,255,255,0.28)', letterSpacing: '-.2px' }}>
                        {n}
                      </span>
                    </>
                  ) : isDone ? (
                    /* ── Case B / Regular completed (milestone or not) ─── */
                    <>
                      <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1, color: 'rgba(255,255,255,0.7)', letterSpacing: '-.2px' }}>{n}</span>
                      <span style={{ fontSize: 18, lineHeight: 1, color: '#fff', fontWeight: 700 }}>✓</span>
                      {shortCat && (
                        <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1, color: 'rgba(255,255,255,0.88)', maxWidth: SW - 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {shortCat}
                        </span>
                      )}
                    </>
                  ) : isCur ? (
                    /* ── Current content ─── */
                    <>
                      <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1, color: '#e0e7ff', letterSpacing: '-.2px' }}>{n}</span>
                      <span style={{ fontSize: 16, lineHeight: 1, color: '#fff' }}>▶</span>
                      <span style={{ fontSize: 9, lineHeight: 1, color: 'rgba(224,231,255,0.85)', fontWeight: 600 }}>Boshlash</span>
                    </>
                  ) : isTestUnlocked ? (
                    /* ── Test-unlocked content ─── */
                    <>
                      <span style={{ fontSize: 11, fontWeight: 800, lineHeight: 1, color: '#c4b5fd', letterSpacing: '-.2px' }}>{n}</span>
                      <span style={{ fontSize: 16, lineHeight: 1, color: 'rgba(196,181,253,0.85)' }}>▶</span>
                    </>
                  ) : (
                    /* ── Locked content ─── */
                    <>
                      <span style={{ fontSize: 15, lineHeight: 1 }}>🔒</span>
                      <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1, color: 'rgba(255,255,255,0.25)', letterSpacing: '-.2px' }}>{n}</span>
                    </>
                  )}
                </div>
              )
            })}

            {/* Student character */}
            {!loading && (
              <div style={{
                position: 'absolute',
                left: curPos.x - 14,
                top:  curPos.y - SW / 2 - 42,
                fontSize: 24, width: 28, textAlign: 'center', lineHeight: '28px',
                zIndex: 30,
                animation: 'studentBounce .85s ease-in-out infinite',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.85))',
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
