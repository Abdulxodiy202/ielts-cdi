'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Trophy, Star, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Dashboard bento tile: top-5 leaderboard + the current user's own rank.
// Fetches on mount and on window focus, throttled to one fetch per 30s
// so tab-switching doesn't hammer the RPC (per spec: no polling).

export interface LeaderRow {
  rank: number
  user_id: string
  display_name: string | null
  avatar_url: string | null
  total_points: number
}

export interface MyRank {
  rank: number
  display_name: string | null
  avatar_url: string | null
  total_points: number
  total_users: number
}

const FETCH_THROTTLE_MS = 30_000

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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg leading-none w-7 text-center shrink-0">🥇</span>
  if (rank === 2) return <span className="text-lg leading-none w-7 text-center shrink-0">🥈</span>
  if (rank === 3) return <span className="text-lg leading-none w-7 text-center shrink-0">🥉</span>
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
    >
      {rank}
    </span>
  )
}

function Avatar({ url, name, size = 32 }: { url: string | null; name: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: 'var(--accent)', fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  )
}

export function LeaderboardWidget() {
  const [topUsers, setTopUsers] = useState<LeaderRow[] | null>(null)
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const lastFetchRef = useRef(0)

  const load = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastFetchRef.current < FETCH_THROTTLE_MS) return
    lastFetchRef.current = now

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [topRes, rankRes] = await Promise.all([
      supabase.rpc('get_leaderboard_top', { p_limit: 5 }),
      user ? supabase.rpc('get_user_rank', { p_user_id: user.id }) : Promise.resolve({ data: null }),
    ])

    setMyUserId(user?.id ?? null)
    setTopUsers(Array.isArray(topRes.data) ? (topRes.data as LeaderRow[]) : [])
    const rankRow = Array.isArray(rankRes.data) ? rankRes.data[0] : rankRes.data
    setMyRank((rankRow as MyRank | null) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(true)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const inTop5 = !!myUserId && (topUsers ?? []).some(u => u.user_id === myUserId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={20} style={{ color: '#f59e0b' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Leaderboard</h2>
      </div>

      {loading ? (
        <div className="space-y-3 flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full shrink-0" style={{ background: 'var(--bg-secondary)' }} />
              <div className="w-8 h-8 rounded-full shrink-0" style={{ background: 'var(--bg-secondary)' }} />
              <div className="flex-1 h-3 rounded" style={{ background: 'var(--bg-secondary)' }} />
            </div>
          ))}
        </div>
      ) : (topUsers ?? []).length === 0 ? (
        <p className="text-sm flex-1" style={{ color: 'var(--text-muted)' }}>
          🎯 Be the first! Complete a test to appear on the leaderboard.
        </p>
      ) : (
        <div className="flex-1">
          {(topUsers ?? []).map((u, i) => {
            const isMe = u.user_id === myUserId
            return (
              <div
                key={u.user_id}
                // Mobile shows top 3 only; ranks 4-5 appear from md up.
                className={`${i >= 3 ? 'hidden md:flex' : 'flex'} items-center gap-2.5 py-1.5 px-1.5 rounded-lg`}
                style={isMe ? { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' } : undefined}
              >
                <RankBadge rank={u.rank} />
                <Avatar url={u.avatar_url} name={u.display_name} />
                <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {truncateName(u.display_name)}{isMe ? ' (You)' : ''}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold shrink-0" style={{ color: '#fbbf24' }}>
                  <Star size={13} fill="#fbbf24" strokeWidth={0} /> {u.total_points}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!loading && (
        <>
          <div className="my-3" style={{ borderTop: '1px solid var(--border)' }} />
          {!inTop5 && (
            myRank ? (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-sm"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--text-primary)' }}
              >
                <span className="font-semibold">You</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span>#{myRank.rank}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="inline-flex items-center gap-1" style={{ color: '#fbbf24' }}>
                  <Star size={12} fill="#fbbf24" strokeWidth={0} /> {myRank.total_points}
                </span>
              </div>
            ) : (
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                You&apos;re not ranked yet — complete a test to join!
              </p>
            )
          )}
          <Link
            href="/dashboard/leaderboard"
            className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent)' }}
          >
            View full leaderboard <ChevronRight size={14} />
          </Link>
        </>
      )}
    </div>
  )
}
