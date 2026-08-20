'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Trophy, Star, Info, X, Pencil } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Modal opens only when the current user clicks the edit-pencil next to
// their name — no need to ship it in the initial leaderboard bundle.
const UsernameEditModal = dynamic(() => import('@/components/UsernameEditModal').then(m => ({ default: m.UsernameEditModal })), { ssr: false })

// Full leaderboard: podium (top 3) + table (4..50) + sticky "your rank"
// footer when the current user is outside the visible range.
//
// Ranking: backend RPC ba'zan tie bo'lganda bir xil rank qaytaradi
// (RANK()) yoki noaniq bo'ladi. Frontend'da index+1 bilan qayta
// hisoblaymiz -- ROW_NUMBER usuli. Backend order (total_points DESC)
// beriladi, biz esa unique o'rin qo'yamiz.

interface LeaderRow {
  rank: number
  user_id: string
  display_name: string | null
  // Optional: RPC may not return it in older environments; we fall back
  // to display_name when it isn't present.
  username?: string | null
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
  username?: string | null
  avatar_url: string | null
  total_points: number
  total_users: number
}

function truncateName(name: string | null): string {
  const n = (name ?? 'User').trim() || 'User'
  return n.length > 15 ? n.slice(0, 15) + '…' : n
}

// Prefer @username when available, then free-form display_name, then the
// email local-part (only meaningful for the current user -- other rows
// won't have an email fallback available client-side).
function labelFor(
  row: { username?: string | null; display_name: string | null },
  emailFallback?: string | null,
): string {
  const raw = row.username || row.display_name || (emailFallback ? emailFallback.split('@')[0] : null)
  return truncateName(raw)
}

function initials(name: string | null): string {
  const n = (name ?? '').trim()
  if (!n) return 'U'
  const parts = n.split(/\s+/)
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : n.slice(0, 2)).toUpperCase()
}

function Avatar({ url, name, size }: { url: string | null; name: string | null; size: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
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
  { key: 'reading_stars' as const,   labelKey: 'nav.reading' },
  { key: 'listening_stars' as const, labelKey: 'nav.listening' },
  { key: 'script_stars' as const,    labelKey: 'script.title' },
  { key: 'article_stars' as const,   labelKey: 'nav.articles' },
  { key: 'video_stars' as const,     labelKey: 'nav.videoCourses' },
  { key: 'game_stars' as const,      labelKey: 'vocabulary.games' },
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

function PodiumCard({ row, place, emailFallback }: { row: LeaderRow; place: 1 | 2 | 3; emailFallback?: string | null }) {
  const { t } = useLanguage()
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
      <Avatar
        url={row.avatar_url}
        name={row.username || row.display_name || emailFallback || null}
        size={64}
      />
      <p className="font-bold mt-2 text-sm truncate max-w-full" style={{ color: 'var(--text-primary)' }}>
        {labelFor(row, emailFallback)}
      </p>
      <p className="inline-flex items-baseline gap-1.5 mt-1" style={{ color: '#fbbf24' }}>
        <Star size={18} fill="#fbbf24" strokeWidth={0} style={{ position: 'relative', top: 3 }} />
        <span className="text-2xl font-black">{row.total_points}</span>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('leaderboard.points')}</span>
      </p>
      <CategoryChips row={row} />
    </div>
  )
}

// Ball hisoblash formulasi modali. Backend'dagi mavjud kurs asosida
// (increment_user_stars): Reading/Listening 3x, Script 2x, boshqalari 1x.
// Labels/rate matnlari useLanguage orqali InfoModal ichida olinadi.
const POINT_RATE_KEYS: { labelKey: string; rateKey: string; color: string }[] = [
  { labelKey: 'leaderboard.rateReading',   rateKey: 'leaderboard.rate3', color: '#60A5FA' },
  { labelKey: 'leaderboard.rateListening', rateKey: 'leaderboard.rate3', color: '#C084FC' },
  { labelKey: 'leaderboard.rateScript',    rateKey: 'leaderboard.rate2', color: '#FACC15' },
  { labelKey: 'leaderboard.rateArticle',   rateKey: 'leaderboard.rate1', color: '#FB923C' },
  { labelKey: 'leaderboard.rateVideo',     rateKey: 'leaderboard.rate1', color: '#F87171' },
  { labelKey: 'leaderboard.rateGame',      rateKey: 'leaderboard.rate1', color: '#4ADE80' },
]

function InfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              zIndex: 51,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('leaderboard.infoTitle')}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
                aria-label={t('leaderboard.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {t('leaderboard.infoDesc')}
              </p>

              <div className="space-y-0">
                {POINT_RATE_KEYS.map(r => (
                  <div
                    key={r.labelKey}
                    className="flex justify-between items-center py-2.5"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t(r.labelKey)}</span>
                    <span className="text-sm font-semibold" style={{ color: r.color }}>{t(r.rateKey)}</span>
                  </div>
                ))}
              </div>

              <div
                className="mt-5 p-4 rounded-xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <div className="text-xs uppercase font-semibold mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {t('leaderboard.example')}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {t('leaderboard.exampleReading')} <b style={{ color: '#fbbf24' }}>15 {t('leaderboard.pts')}</b>
                  <br />
                  {t('leaderboard.exampleArticle')} <b style={{ color: '#fbbf24' }}>3 {t('leaderboard.pts')}</b>
                </div>
              </div>

              <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                {t('leaderboard.footerNote')}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default function LeaderboardPage() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myEmail, setMyEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)
  const [usernameEditOpen, setUsernameEditOpen] = useState(false)

  // Bumping `reloadTick` refetches the leaderboard -- used after the
  // username edit modal saves. Keeps setState out of the effect callee.
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const [topRes, rankRes] = await Promise.all([
        supabase.rpc('get_leaderboard_top', { p_limit: 50 }),
        user ? supabase.rpc('get_user_rank', { p_user_id: user.id }) : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      setMyUserId(user?.id ?? null)
      setMyEmail(user?.email ?? null)
      // Backend qanday rank qaytarishidan qat'iy nazar, biz ROW_NUMBER
      // (index+1) bilan qayta hisoblaymiz -- teng balda ham unique
      // o'rin bo'ladi (Tommy 4, sarvinoz 5, backend tie'da 4/4 bergan
      // bo'lsa ham).
      const raw = Array.isArray(topRes.data) ? (topRes.data as LeaderRow[]) : []
      setRows(raw.map((r, i) => ({ ...r, rank: i + 1 })))
      const rankRow = Array.isArray(rankRes.data) ? rankRes.data[0] : rankRes.data
      setMyRank((rankRow as MyRank | null) ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [reloadTick])

  const myCurrentUsername =
    (rows ?? []).find(r => r.user_id === myUserId)?.username
    ?? myRank?.username
    ?? null

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
        <ChevronLeft size={14} /> {t('leaderboard.backToDashboard')}
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Trophy size={28} style={{ color: '#f59e0b' }} /> {t('leaderboard.title')}
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label={t('leaderboard.infoAria')}
            className="ml-1 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            <Info size={14} />
          </button>
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('leaderboard.subtitle')}</p>
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
            {t('leaderboard.noResultsYet')}
          </p>
        </div>
      ) : (
        <>
          {/* Podium: visually 2nd | 1st | 3rd on desktop, stacked 1-2-3 on mobile */}
          {top3.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-10">
              {top3.length >= 2 && <div className="sm:order-1 order-2 flex-1 flex"><PodiumCard row={top3[1]} place={2} emailFallback={top3[1].user_id === myUserId ? myEmail : null} /></div>}
              <div className="sm:order-2 order-1 flex-1 flex"><PodiumCard row={top3[0]} place={1} emailFallback={top3[0].user_id === myUserId ? myEmail : null} /></div>
              {top3.length >= 3 && <div className="sm:order-3 order-3 flex-1 flex"><PodiumCard row={top3[2]} place={3} emailFallback={top3[2].user_id === myUserId ? myEmail : null} /></div>}
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
                      <th className="py-3 px-3 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{t('leaderboard.colUser')}</th>
                      {CATEGORY_COLS.map(c => (
                        <th key={c.key} className="py-3 px-3 text-center font-semibold hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
                          {t(c.labelKey)}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-right font-semibold" style={{ color: 'var(--text-muted)' }}>{t('leaderboard.colTotal')}</th>
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
                              <Avatar
                                url={r.avatar_url}
                                name={r.username || r.display_name || (isMe ? myEmail : null)}
                                size={30}
                              />
                              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                {labelFor(r, isMe ? myEmail : null)}{isMe ? ` ${t('leaderboard.you')}` : ''}
                              </span>
                              {isMe && (
                                <button
                                  type="button"
                                  onClick={() => setUsernameEditOpen(true)}
                                  aria-label={t('leaderboard.editUsername')}
                                  className="p-1 rounded-md hover:opacity-80"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </span>
                          </td>
                          {/* Nol qiymatlar "—" o'rniga "★ 0" -- foydalanuvchi
                              qaysi kategoriyada mashq qilmaganini ko'radi. */}
                          {CATEGORY_COLS.map(c => {
                            const v = r[c.key]
                            return (
                              <td
                                key={c.key}
                                className="py-2.5 px-3 text-center hidden md:table-cell"
                                style={{ color: v > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                              >
                                ★ {v}
                              </td>
                            )
                          })}
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-flex items-baseline gap-1 font-bold" style={{ color: '#fbbf24' }}>
                              <Star size={13} fill="#fbbf24" strokeWidth={0} style={{ position: 'relative', top: 2 }} />
                              <span className="text-base">{r.total_points}</span>
                              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{t('leaderboard.points')}</span>
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
          className="fixed bottom-0 left-0 right-0 py-3 px-6 text-center text-sm font-semibold z-40 flex items-center justify-center gap-2"
          style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          {t('leaderboard.yourRank')}: #{myRank.rank} · <span style={{ color: '#fbbf24' }}>⭐ {myRank.total_points} {t('leaderboard.points')}</span> · {t('leaderboard.keepGoing')}
          <button
            type="button"
            onClick={() => setUsernameEditOpen(true)}
            className="ml-2 p-1 rounded-md hover:opacity-80"
            aria-label={t('leaderboard.editUsername')}
            style={{ color: 'var(--text-muted)' }}
          >
            <Pencil size={12} />
          </button>
        </div>
      )}

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
      {usernameEditOpen && (
        <UsernameEditModal
          open
          currentUsername={myCurrentUsername}
          onClose={() => setUsernameEditOpen(false)}
          onSaved={() => setReloadTick(t => t + 1)}
        />
      )}
    </div>
  )
}
