'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Trophy, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Full leaderboard: podium (top 3) + table (4..50) + sticky "your rank"
// footer when the current user is outside the visible range.

interface LeaderRow {
  rank: number
  user_id: string
  display_name: string | null
  avatar_url: string | null
  total_points: number
  reading_stars: number
  listening_stars: number
  script_stars: number
  article_stars: number
  video_stars: number
  game_stars: number
}

interface MyRank {
  rank: number
  display_name: string | null
  avatar_url: string | null
  total_points: number
  total_users: number
}

function truncateName(name: string | null): string {
  const n = (name ?? 'User').trim() || 'User'
  return n.length > 15 ? n.slice(0, 15) + '…' : n
}

function initials(name: string | null): string {
  const n = (name ?? '').trim()
  if (!n) return 'U'
  const parts = n.split(/\s+/)
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase()
}

function Avatar({ url, name, size }: { url: string | null; name: string | null; size: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: 'var(--accent)', fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  )
}

const CATEGORY_COLS = [
  { key: 'reading_stars' as const,   label: 'Reading' },
  { key: 'listening_stars' as const, label: 'Listening' },
  { key: 'script_stars' as const,    label: 'Script' },
  { key: 'article_stars' as const,   label: 'Articles' },
  { key: 'video_stars' as const,     label: 'Videos' },
  { key: 'game_stars' as const,      label: 'Games' },
]

function CategoryChips({ row }: { row: LeaderRow }) {
  const chips = [
    ['R', row.reading_stars], ['L', row.listening_stars], ['S', row.script_stars],
    ['A', row.article_stars], ['V', row.video_stars], ['G', row.game_stars],
  ] as const
  return (
    <div className="flex flex-wrap justify-center gap-1 mt-2">
      {chips.map(([label, n]) => (
        <span
          key={label}
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          {label}:{n}
        </span>
      ))}
    </div>
  )
}

function PodiumCard({ row, place }: { row: LeaderRow; place: 1 | 2 | 3 }) {
  const border =
    place === 1 ? '2px solid #f59e0b' :
    place === 2 ? '1px solid #94a3b8' :
    '1px solid #c2410c'
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'
  return (
    <div
      className="rounded-2xl p-5 flex flex-col items-center text-center flex-1"
      style={{
        background: 'var(--bg-card)',
        border,
        transform: place === 1 ? 'scale(1.05)' : undefined,
        boxShadow: place === 1 ? '0 0 24px rgba(245,158,11,0.25)' : undefined,
        zIndex: place === 1 ? 1 : 0,
      }}
    >
      <div className="text-2xl mb-2">{medal}</div>
      <Avatar url={row.avatar_url} name={row.display_name} size={64} />
      <p className="font-bold mt-2 text-sm truncate max-w-full" style={{ color: 'var(--text-primary)' }}>
        {truncateName(row.display_name)}
      </p>
      <p className="inline-flex items-center gap-1.5 text-2xl font-black mt-1" style={{ color: '#fbbf24' }}>
        <Star size={20} fill="#fbbf24" strokeWidth={0} /> {row.total_points}
      </p>
      <CategoryChips row={row} />
    </div>
  )
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const [topRes, rankRes] = await Promise.all([
        supabase.rpc('get_leaderboard_top', { p_limit: 50 }),
        user ? supabase.rpc('get_user_rank', { p_user_id: user.id }) : Promise.resolve({ data: null }),
      ])
      setMyUserId(user?.id ?? null)
      setRows(Array.isArray(topRes.data) ? (topRes.data as LeaderRow[]) : [])
      const rankRow = Array.isArray(rankRes.data) ? rankRes.data[0] : rankRes.data
      setMyRank((rankRow as MyRank | null) ?? null)
      setLoading(false)
    }
    load()
  }, [])

  const top3 = (rows ?? []).slice(0, 3)
  const rest = (rows ?? []).slice(3)
  const inVisibleList = !!myUserId && (rows ?? []).some(r => r.user_id === myUserId)
  const showStickyRank = !loading && !!myRank && !inVisibleList

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ paddingBottom: showStickyRank ? 96 : undefined }}>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={14} /> Back to dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Trophy size={28} style={{ color: '#f59e0b' }} /> Leaderboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Top learners on IELTS CDI</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : (rows ?? []).length === 0 ? (
        <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-4xl mb-3">🎯</div>
          <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
            No one has earned points yet. Be the first!
          </p>
        </div>
      ) : (
        <>
          {/* Podium: visually 2nd | 1st | 3rd on desktop, stacked 1-2-3 on mobile */}
          {top3.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-10">
              {top3.length >= 2 && <div className="sm:order-1 order-2 flex-1 flex"><PodiumCard row={top3[1]} place={2} /></div>}
              <div className="sm:order-2 order-1 flex-1 flex"><PodiumCard row={top3[0]} place={1} /></div>
              {top3.length >= 3 && <div className="sm:order-3 order-3 flex-1 flex"><PodiumCard row={top3[2]} place={3} /></div>}
            </div>
          )}

          {/* Rank 4+ table */}
          {rest.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <th className="py-3 px-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>#</th>
                      <th className="py-3 px-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>User</th>
                      {CATEGORY_COLS.map(c => (
                        <th key={c.key} className="py-3 px-3 text-center font-semibold hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                          {c.label}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map(r => {
                      const isMe = r.user_id === myUserId
                      return (
                        <tr
                          key={r.user_id}
                          className="transition-colors hover:bg-[var(--bg-card-hover)]"
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isMe ? 'rgba(99,102,241,0.08)' : undefined,
                            borderLeft: isMe ? '2px solid var(--accent)' : '2px solid transparent',
                          }}
                        >
                          <td className="py-2.5 px-3 font-bold" style={{ color: 'var(--text-muted)' }}>{r.rank}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-2.5">
                              <Avatar url={r.avatar_url} name={r.display_name} size={30} />
                              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                {truncateName(r.display_name)}{isMe ? ' (You)' : ''}
                              </span>
                            </span>
                          </td>
                          {CATEGORY_COLS.map(c => (
                            <td key={c.key} className="py-2.5 px-3 text-center hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>
                              {r[c.key] > 0 ? `⭐ ${r[c.key]}` : '—'}
                            </td>
                          ))}
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-flex items-center gap-1 font-bold text-base" style={{ color: '#fbbf24' }}>
                              <Star size={14} fill="#fbbf24" strokeWidth={0} /> {r.total_points}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sticky "your rank" footer when the user is outside the top 50 */}
      {showStickyRank && myRank && (
        <div
          className="fixed bottom-0 left-0 right-0 py-3 px-6 text-center text-sm font-semibold z-40"
          style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          Your rank: #{myRank.rank} · <span style={{ color: '#fbbf24' }}>⭐ {myRank.total_points}</span> · Keep going!
        </div>
      )}
    </div>
  )
}
