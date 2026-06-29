'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Level {
  level_number: number
  title: string
  difficulty: string
  status: 'completed' | 'current' | 'locked'
  score: number
  max_score: number
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
}

function Stone({ level, onClick }: { level: Level; onClick: () => void }) {
  const isCompleted = level.status === 'completed'
  const isCurrent = level.status === 'current'
  const isLocked = level.status === 'locked'

  let bg = 'rgba(255,255,255,0.08)'
  let border = '2px solid rgba(255,255,255,0.12)'
  let textColor = 'var(--text-muted)'
  let cursor = 'default'
  let shadow = 'none'

  if (isCompleted) {
    bg = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
    border = '2px solid #16a34a'
    textColor = '#fff'
    cursor = 'pointer'
    shadow = '0 4px 12px rgba(34,197,94,0.35)'
  } else if (isCurrent) {
    bg = 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
    border = '2px solid #7c3aed'
    textColor = '#fff'
    cursor = 'pointer'
    shadow = '0 4px 20px rgba(139,92,246,0.5), 0 0 0 3px rgba(139,92,246,0.25)'
  } else {
    cursor = 'not-allowed'
  }

  return (
    <div
      onClick={() => !isLocked && onClick()}
      style={{
        width: 56, height: 56, borderRadius: 16,
        background: bg, border, boxShadow: shadow,
        color: textColor, cursor,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.15s, box-shadow 0.15s',
        userSelect: 'none',
        fontSize: 11, fontWeight: 700,
        gap: 1,
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isLocked) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
    >
      {isLocked ? (
        <span style={{ fontSize: 18, opacity: 0.4 }}>🔒</span>
      ) : isCompleted ? (
        <>
          <span style={{ fontSize: 14 }}>✓</span>
          <span style={{ fontSize: 9 }}>{level.score}/{level.max_score}</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 14 }}>▶</span>
          <span style={{ fontSize: 9 }}>Boshlash</span>
        </>
      )}
      <span style={{
        position: 'absolute', top: -10,
        fontSize: 9, fontWeight: 700,
        color: isLocked ? 'var(--text-muted)' : isCompleted ? '#86efac' : '#c4b5fd',
      }}>
        {level.level_number}
      </span>
    </div>
  )
}

export default function GamesPage() {
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const currentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/game/levels')
      .then(r => r.json())
      .then(data => {
        setLevels(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading && currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading])

  const rows: Level[][] = []
  for (let i = 0; i < 100; i += 5) {
    const rowLevels = levels.slice(i, i + 5)
    const rowIndex = Math.floor(i / 5)
    rows.push(rowIndex % 2 === 1 ? [...rowLevels].reverse() : rowLevels)
  }

  const completedCount = levels.filter(l => l.status === 'completed').length

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: 400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/vocabulary" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Lug'at
        </Link>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>🎮 O'yinlar</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              100 ta darajadagi so'z o'yini
            </p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            borderRadius: 12, padding: '8px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{completedCount}</div>
            <div style={{ fontSize: 9, color: '#c4b5fd', fontWeight: 600 }}>/ 100</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', paddingTop: 40 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {[...Array(5)].map((_, j) => (
                <div key={j} style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((row, rowIdx) => {
            const actualRowIdx = rowIdx
            return (
              <div key={actualRowIdx} style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {row.map(level => (
                  <div
                    key={level.level_number}
                    ref={level.status === 'current' ? currentRef : undefined}
                  >
                    <Stone
                      level={level}
                      onClick={() => router.push(`/vocabulary/games/${level.level_number}`)}
                    />
                  </div>
                ))}
              </div>
            )
          })}
          <div style={{ height: 40 }} />
        </div>
      )}
    </div>
  )
}
