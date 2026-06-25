'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ChevronRight, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'

interface Article {
  id: string
  title: string
  file_url: string | null
  cover_image_url: string | null
  is_premium: boolean
  is_published: boolean
  created_at: string
}

const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  'linear-gradient(135deg, #16a34a 0%, #0d9488 100%)',
  'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
]

function getGradient(id: string) {
  const num = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[num % GRADIENTS.length]
}

export default function ArticlesPage() {
  const router = useRouter()
  const [articles, setArticles]   = useState<Article[]>([])
  const [loading, setLoading]     = useState(true)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single()
        .then(({ data }) => setIsPremium(isActivePremium(data)))
    })

    fetch('/api/articles')
      .then(async r => {
        const d = await r.json().catch(() => [])
        if (Array.isArray(d)) setArticles(d)
      })
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
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Maqolalar
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          IELTS uchun foydali inglizcha maqolalar
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-4"
          style={{ color: 'var(--text-muted)' }}>
          <BookOpen size={48} className="opacity-20" />
          <p className="font-medium">Hali maqolalar qo&apos;shilmagan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {articles.map(article => {
            const locked = article.is_premium && !isPremium
            const canRead = !locked && !!article.file_url

            return (
              <div
                key={article.id}
                className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  cursor: canRead ? 'pointer' : 'default',
                }}
                onClick={() => canRead && router.push(`/articles/${article.id}`)}
                onMouseEnter={e => {
                  if (canRead) {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {/* Cover */}
                <div className="relative" style={{ height: 190, flexShrink: 0 }}>
                  {article.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={article.cover_image_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: getGradient(article.id) }}
                    >
                      <BookOpen size={48} color="rgba(255,255,255,0.25)" />
                    </div>
                  )}

                  {/* Premium badge overlay */}
                  <div className="absolute top-3 right-3">
                    {article.is_premium ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{
                          background: 'rgba(245,158,11,0.9)',
                          color: 'white',
                          backdropFilter: 'blur(4px)',
                        }}>
                        👑 Premium
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{
                          background: 'rgba(34,197,94,0.85)',
                          color: 'white',
                          backdropFilter: 'blur(4px)',
                        }}>
                        Bepul
                      </span>
                    )}
                  </div>

                  {/* Lock overlay */}
                  {locked && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                      style={{
                        background: 'rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                        <Lock size={22} color="white" />
                      </div>
                      <span className="text-xs font-semibold text-white opacity-90">Premium kerak</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-col flex-1 p-4 gap-3">
                  <h3
                    className="font-bold leading-snug"
                    style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.4 }}
                  >
                    {article.title}
                  </h3>

                  <div className="mt-auto">
                    {locked ? (
                      <button
                        onClick={e => { e.stopPropagation(); router.push('/pricing') }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: 'rgba(245,158,11,0.1)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245,158,11,0.3)',
                        }}
                      >
                        <Lock size={14} /> Premium olish
                      </button>
                    ) : !article.file_url ? (
                      <div className="w-full py-2.5 text-center text-sm rounded-xl"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        Tez kunda
                      </div>
                    ) : (
                      <button
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: 'var(--accent)', color: 'white' }}
                      >
                        O&apos;qish <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
