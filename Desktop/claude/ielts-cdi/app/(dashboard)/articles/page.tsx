'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ChevronRight, BookOpen, Star, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Article {
  id: string
  title: string
  file_url: string | null
  cover_image_url: string | null
  is_premium: boolean
  is_published: boolean
  created_at: string
}

// Best-star lookup, keyed by article_id, populated once at mount from
// article_test_results for the current user. Missing key = user hasn't
// taken the test yet.
type StarMap = Record<string, number>

const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  'linear-gradient(135deg, #16a34a 0%, #0d9488 100%)',
  'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
]

function getGradient(id: string) {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[n % GRADIENTS.length]
}

export default function ArticlesPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [articles, setArticles]   = useState<Article[]>([])
  const [loading, setLoading]     = useState(true)
  const [isPremium, setIsPremium] = useState(false)
  const [stars, setStars]         = useState<StarMap>({})

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single()
        .then(({ data }) => setIsPremium(isActivePremium(data)))
      supabase
        .from('article_test_results')
        .select('article_id, best_stars')
        .eq('user_id', user.id)
        .then(({ data }) => {
          if (!Array.isArray(data)) return
          const map: StarMap = {}
          for (const r of data as { article_id: string; best_stars: number }[]) {
            map[r.article_id] = r.best_stars
          }
          setStars(map)
        })
    })
    fetch('/api/articles')
      .then(async r => { const d = await r.json().catch(() => []); if (Array.isArray(d)) setArticles(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('articles.title')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('articles.subtitle')}</p>
      </div>

      {articles.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-4" style={{ color: 'var(--text-muted)' }}>
          <BookOpen size={48} className="opacity-20" />
          <p className="font-medium">{t('articles.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {articles.map(article => {
            const locked = article.is_premium && !isPremium
            const canRead = !locked && !!article.file_url
            const bestStars = stars[article.id] ?? 0

            return (
              <div
                key={article.id}
                className="rounded-2xl flex flex-col transition-all duration-200"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.14)'
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {/* ── TOP: Title + Badge ── */}
                <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
                  <h3
                    className="font-bold leading-snug"
                    style={{ fontSize: 17, color: 'var(--text-primary)', lineHeight: 1.35 }}
                  >
                    {article.title}
                  </h3>
                  {article.is_premium ? (
                    <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', whiteSpace: 'nowrap' }}>
                      👑 {t('common.premium')}
                    </span>
                  ) : (
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)', whiteSpace: 'nowrap' }}>
                      {t('common.free')}
                    </span>
                  )}
                </div>

                {/* ── MIDDLE: Cover image ── */}
                <div className="relative mx-4 rounded-xl overflow-hidden" style={{ maxHeight: 200, flexShrink: 0 }}>
                  {article.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.cover_image_url} alt={article.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: getGradient(article.id) }}>
                      <BookOpen size={44} color="rgba(255,255,255,0.22)" />
                    </div>
                  )}

                  {/* Best-stars badge (only if user has scored >=1 star).
                      Sits top-LEFT of the poster; the Free/Premium chip
                      lives in the header row above the poster, so the two
                      never collide. Size + glow tuned to be noticeable
                      from a scroll away. */}
                  {bestStars > 0 && (
                    <div
                      className="absolute inline-flex items-center rounded-full font-bold"
                      style={{
                        top: 12,
                        left: 12,
                        gap: 6,
                        padding: '8px 14px',
                        fontSize: 18,
                        color: 'white',
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 4px 12px rgba(251, 191, 36, 0.35)',
                        zIndex: 2,
                        pointerEvents: 'none',
                      }}
                    >
                      <Star size={22} fill="#fbbf24" strokeWidth={0} />
                      {bestStars}
                    </div>
                  )}

                  {/* Lock overlay */}
                  {locked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                      style={{ background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(6px)' }}>
                      <div className="w-11 h-11 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                        <Lock size={20} color="white" />
                      </div>
                      <span className="text-xs font-semibold text-white opacity-90">{t('common.premiumRequired')}</span>
                    </div>
                  )}
                </div>

                {/* ── BOTTOM: Action buttons (Read + Test) ── */}
                <div className="px-4 pt-3 pb-4 flex gap-2" style={{ marginTop: 'auto' }}>
                  {locked ? (
                    <button
                      onClick={() => router.push(`/articles/${article.id}`)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                      <Lock size={13} /> {t('articles.premium')}
                    </button>
                  ) : (
                    <>
                      {canRead ? (
                        <button
                          onClick={() => router.push(`/articles/${article.id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                          style={{ background: 'var(--accent)', color: 'white' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          {t('articles.read')} <ChevronRight size={15} />
                        </button>
                      ) : (
                        <div className="flex-1 py-2.5 text-center text-sm rounded-xl"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {t('articles.soon')}
                        </div>
                      )}
                      <button
                        onClick={() => router.push(`/articles/${article.id}/test`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                        style={{ background: '#10b981', color: 'white' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        <ClipboardCheck size={14} /> {t('articles.takeTest')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
