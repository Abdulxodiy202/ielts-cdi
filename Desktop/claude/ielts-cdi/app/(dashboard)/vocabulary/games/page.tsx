'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/* ── Types ───────────────────────────────────────────────────────── */
interface Level {
  level_number: number
  title: string
  difficulty: string
  status: 'completed' | 'current' | 'locked'
  score: number
  max_score: number
}

/* ── Layout constants ────────────────────────────────────────────── */
const COLS = 5
const ROWS = 20        // 100 levels / 5 cols
const SR   = 30        // stone radius
const CSP  = 80        // column spacing (center-to-center)
const RSP  = 96        // row spacing
const PX   = 50        // left/right padding to first stone center
const PY   = 70        // top/bottom padding

const CW = PX * 2 + (COLS - 1) * CSP   // 420 px
const CH = PY * 2 + (ROWS - 1) * RSP + SR * 2  // 2012 px

/* ── Milestone config ────────────────────────────────────────────── */
const MILESTONES: Record<number, { em: string }> = {
  10:  { em: '🌟' },
  20:  { em: '🏆' },
  50:  { em: '💎' },
  100: { em: '👑' },
}

/* ── Position calculator: level 1 at bottom ─────────────────────── */
function stonePos(n: number): { x: number; y: number } {
  const idx  = n - 1
  const row  = Math.floor(idx / COLS)
  const col  = idx % COLS
  const vRow = ROWS - 1 - row          // flip: row0 → vRow19 (bottom)
  const x    = vRow % 2 === 1          // odd vRow → right-to-left
    ? PX + (COLS - 1 - col) * CSP
    : PX + col * CSP
  const y = PY + vRow * RSP
  return { x, y }
}

/* Pre-compute all 100 positions */
const ALL_PTS = Array.from({ length: 100 }, (_, i) => stonePos(i + 1))
const FULL_D  = ALL_PTS.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

/* ── CSS keyframes ───────────────────────────────────────────────── */
const ANIM = `
@keyframes bookBounce {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-11px); }
}
@keyframes pulseRing {
  0%,100% { box-shadow: 0 0 0 5px rgba(74,222,128,.28), 0 6px 24px rgba(74,222,128,.55); }
  50%     { box-shadow: 0 0 0 13px rgba(74,222,128,.1), 0 8px 36px rgba(74,222,128,.85); }
}
@keyframes cloudDrift {
  0%,100% { transform: translateX(0)   translateY(0); }
  40%     { transform: translateX(5px) translateY(-9px); }
  70%     { transform: translateX(-3px) translateY(-5px); }
}
`

/* ── Cloud SVG ───────────────────────────────────────────────────── */
function Cloud({ w = 110, op = 0.6 }: { w?: number; op?: number }) {
  return (
    <svg width={w} height={Math.round(w * 0.58)} viewBox="0 0 110 64">
      <ellipse cx="55" cy="48" rx="46" ry="22" fill={`rgba(255,255,255,${op})`} />
      <ellipse cx="36" cy="34" rx="28" ry="22" fill={`rgba(255,255,255,${op})`} />
      <ellipse cx="74" cy="36" rx="26" ry="20" fill={`rgba(255,255,255,${op})`} />
    </svg>
  )
}

/* ── Pine tree SVG ───────────────────────────────────────────────── */
function Pine({ h = 80, col = '#1a5c34' }: { h?: number; col?: string }) {
  return (
    <svg width={Math.round(h * 0.66)} height={h} viewBox="0 0 66 100">
      <polygon points="33,4 63,52 3,52"   fill={col} />
      <polygon points="33,26 59,68 7,68"  fill={col} opacity={0.88} />
      <polygon points="33,46 57,88 9,88"  fill={col} opacity={0.76} />
      <rect x="27" y="86" width="12" height="14" rx="2" fill="#5c3d1e" />
    </svg>
  )
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function GamesPage() {
  const [levels, setLevels]   = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const router     = useRouter()
  const currentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/game/levels')
      .then(r => r.json())
      .then((d: Level[]) => { setLevels(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading && currentRef.current) {
      setTimeout(() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180)
    }
  }, [loading])

  const lvlMap = useMemo(() => new Map(levels.map(l => [l.level_number, l])), [levels])
  const doneN  = levels.filter(l => l.status === 'completed').length
  const curN   = levels.find(l => l.status === 'current')?.level_number ?? 1
  const curPos = stonePos(curN)

  /* gold path up to last completed level */
  const goldD = useMemo(() => {
    if (doneN < 2) return ''
    const pts = Array.from({ length: doneN }, (_, i) => stonePos(i + 1))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  }, [doneN])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ANIM }} />

      {/* ── Full gradient background (sky→forest, top→bottom) ─── */}
      <div style={{
        position: 'relative',
        minHeight: CH + 120,
        background: [
          'linear-gradient(to bottom,',
          '#bde0fe 0%, #87CEEB 10%,',
          '#b0dab9 32%, #52b788 48%,',
          '#2d6a4f 68%, #1a4a2e 100%)',
        ].join(' '),
        overflowX: 'hidden',
      }}>

        {/* ── Sticky header ──────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 20px',
          background: 'rgba(0,0,0,0.22)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Link href="/vocabulary" style={{
            color: 'rgba(255,255,255,0.82)',
            textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}>
            ← Lug'at
          </Link>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-.3px' }}>
            🎮 So'z O'yini
          </span>
          <div style={{
            background: 'rgba(255,255,255,0.13)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 10, padding: '5px 13px', textAlign: 'center',
          }}>
            <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 14 }}>{doneN}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>/100</span>
          </div>
        </div>

        {/* ── Canvas wrapper ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20, paddingBottom: 60 }}>
          <div style={{ position: 'relative', width: CW, height: CH }}>

            {/* Sky-glow tint for top 38% */}
            <div style={{
              position: 'absolute', top: 0, left: -60, right: -60,
              height: CH * 0.38,
              background: 'linear-gradient(to bottom, rgba(190,228,255,0.18) 0%, transparent 100%)',
              pointerEvents: 'none',
            }} />

            {/* ── Floating clouds (top area = levels 61-100 zone) ── */}
            {([
              { x: -44,      y: 35,  w: 130, op: 0.70, delay: '0s',   dur: '4.3s' },
              { x: CW - 82,  y: 95,  w: 105, op: 0.60, delay: '1.5s', dur: '3.9s' },
              { x: CW/2-50,  y: 215, w: 88,  op: 0.50, delay: '0.8s', dur: '4.9s' },
              { x: -28,      y: 345, w: 78,  op: 0.42, delay: '2.2s', dur: '3.6s' },
              { x: CW - 72,  y: 445, w: 112, op: 0.36, delay: '1.1s', dur: '5.1s' },
              { x: 42,       y: 565, w: 76,  op: 0.30, delay: '0.5s', dur: '4.1s' },
              { x: CW - 58,  y: 675, w: 84,  op: 0.25, delay: '2.0s', dur: '3.8s' },
            ] as const).map((c, i) => (
              <div key={i} style={{
                position: 'absolute', left: c.x, top: c.y, zIndex: 2,
                animation: `cloudDrift ${c.dur} ease-in-out infinite`,
                animationDelay: c.delay, pointerEvents: 'none',
              }}>
                <Cloud w={c.w} op={c.op} />
              </div>
            ))}

            {/* ── Pine trees (bottom = levels 1-20 forest zone) ──── */}
            {([
              { x: -52,     y: CH - 316, h: 88, col: '#155a30' },
              { x: CW + 6,  y: CH - 280, h: 74, col: '#1a6335' },
              { x: -36,     y: CH - 196, h: 68, col: '#0f4422' },
              { x: CW + 3,  y: CH - 163, h: 64, col: '#1a5c34' },
              { x: -46,     y: CH - 95,  h: 80, col: '#155a30' },
              { x: CW + 7,  y: CH - 68,  h: 60, col: '#0f4422' },
              { x: 2,       y: CH - 55,  h: 50, col: '#1a5c34' },
            ] as const).map((t, i) => (
              <div key={i} style={{
                position: 'absolute', left: t.x, top: t.y,
                pointerEvents: 'none', zIndex: 2, opacity: 0.88,
              }}>
                <Pine h={t.h} col={t.col} />
              </div>
            ))}

            {/* ── SVG path layer ─────────────────────────────────── */}
            <svg width={CW} height={CH}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>

              {/* Track shadow */}
              <path d={FULL_D} fill="none"
                stroke="rgba(0,0,0,0.18)" strokeWidth={14}
                strokeLinejoin="round" strokeLinecap="round" />

              {/* Track base */}
              <path d={FULL_D} fill="none"
                stroke="rgba(255,255,255,0.14)" strokeWidth={12}
                strokeLinejoin="round" strokeLinecap="round" />

              {/* Track dashes */}
              <path d={FULL_D} fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth={3}
                strokeDasharray="7 14"
                strokeLinejoin="round" strokeLinecap="round" />

              {/* Gold completed segment */}
              {goldD && (
                <>
                  <path d={goldD} fill="none"
                    stroke="rgba(251,191,36,0.58)" strokeWidth={12}
                    strokeLinejoin="round" strokeLinecap="round" />
                  <path d={goldD} fill="none"
                    stroke="rgba(254,240,138,0.5)" strokeWidth={4}
                    strokeDasharray="6 12"
                    strokeLinejoin="round" strokeLinecap="round" />
                </>
              )}
            </svg>

            {/* ── 100 Level stones ────────────────────────────────── */}
            {Array.from({ length: 100 }, (_, i) => {
              const n        = i + 1
              const { x, y } = stonePos(n)
              const lvl      = lvlMap.get(n)
              const st       = lvl?.status ?? 'locked'
              const isDone   = st === 'completed'
              const isCur    = st === 'current'
              const isLocked = st === 'locked'
              const isSky    = n >= 61
              const ms       = MILESTONES[n]
              const r        = ms ? SR + 10 : SR

              let bg   = ''
              let bord = ''
              let shad = ''
              let anim = ''

              if (isDone && ms) {
                bg   = 'linear-gradient(135deg,#fef3c7,#fde68a)'
                bord = '3px solid #f59e0b'
                shad = '0 4px 20px rgba(245,158,11,.6)'
              } else if (isDone) {
                bg   = 'linear-gradient(135deg,#86efac,#22c55e)'
                bord = '3px solid #15803d'
                shad = '0 4px 12px rgba(34,197,94,.45)'
              } else if (isCur) {
                bg   = 'linear-gradient(135deg,#4ade80,#16a34a)'
                bord = '3px solid #166534'
                shad = '0 0 0 5px rgba(74,222,128,.28), 0 6px 24px rgba(74,222,128,.55)'
                anim = 'pulseRing 2s ease-in-out infinite'
              } else if (isSky) {
                bg   = 'rgba(255,255,255,0.14)'
                bord = '2px solid rgba(255,255,255,0.28)'
                shad = 'inset 0 1px 0 rgba(255,255,255,0.25)'
              } else {
                bg   = 'rgba(0,0,0,0.3)'
                bord = '2px solid rgba(255,255,255,0.1)'
              }

              return (
                <div
                  key={n}
                  ref={isCur ? currentRef : undefined}
                  onClick={() => { if (!isLocked) router.push(`/vocabulary/games/${n}`) }}
                  style={{
                    position: 'absolute',
                    left: x - r, top: y - r,
                    width: r * 2, height: r * 2,
                    borderRadius: '50%',
                    background: bg, border: bord, boxShadow: shad,
                    animation: anim || undefined,
                    cursor: isLocked ? 'default' : 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: isCur ? 20 : 10,
                    transition: 'transform .15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isLocked) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.12)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
                  }}
                >
                  {/* Stone content */}
                  {ms && (isDone || isCur) ? (
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{ms.em}</span>
                  ) : isDone ? (
                    <>
                      <span style={{ fontSize: 14, color: '#fff', fontWeight: 900, lineHeight: 1 }}>✓</span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,.82)', fontWeight: 700 }}>
                        {lvl?.score}/{lvl?.max_score}
                      </span>
                    </>
                  ) : isCur ? (
                    <span style={{ fontSize: 20, color: '#fff', lineHeight: 1 }}>▶</span>
                  ) : ms ? (
                    <span style={{ fontSize: 22, opacity: 0.28 }}>{ms.em}</span>
                  ) : (
                    <span style={{ fontSize: 13, opacity: 0.38, lineHeight: 1 }}>
                      {isSky ? '☁' : '🔒'}
                    </span>
                  )}

                  {/* Level number above stone */}
                  <div style={{
                    position: 'absolute',
                    top: -17,
                    fontSize: 10, fontWeight: 800, letterSpacing: '-.3px',
                    color: isDone ? '#fbbf24' : isCur ? '#4ade80' : 'rgba(255,255,255,.3)',
                    textShadow: '0 1px 4px rgba(0,0,0,.8)',
                    whiteSpace: 'nowrap',
                  }}>
                    {n}
                  </div>
                </div>
              )
            })}

            {/* ── Book character — bouncing at current level ───────── */}
            {!loading && (
              <div style={{
                position: 'absolute',
                left: curPos.x - 18,
                top:  curPos.y - SR - 48,
                fontSize: 30, lineHeight: '36px',
                width: 36, textAlign: 'center',
                zIndex: 30,
                animation: 'bookBounce .85s ease-in-out infinite',
                filter: 'drop-shadow(0 3px 8px rgba(0,0,0,.55))',
                pointerEvents: 'none',
                transition: 'left .9s cubic-bezier(.4,0,.2,1), top .9s cubic-bezier(.4,0,.2,1)',
              }}>
                📖
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
