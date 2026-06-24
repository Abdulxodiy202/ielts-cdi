'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Lock, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'

interface Article {
  id: string
  title: string
  file_url: string | null
  is_premium: boolean
  is_published: boolean
  created_at: string
}

export default function ArticlesPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading]   = useState(true)
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
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Maqolalar</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>IELTS uchun foydali inglizcha maqolalar</p>
      </div>

      {articles.length === 0 ? (
        <div className="py-16 text-center rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <BookOpen size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Hali maqolalar qo&apos;shilmagan</p>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map(article => {
            const locked = article.is_premium && !isPremium

            return (
              <div
                key={article.id}
                onClick={() => !locked && article.file_url && router.push(`/articles/${article.id}`)}
                className="flex items-center justify-between gap-4 p-4 rounded-xl transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  cursor: locked || !article.file_url ? 'default' : 'pointer',
                  opacity: !article.file_url ? 0.5 : 1,
                }}
                onMouseEnter={e => {
                  if (!locked && article.file_url) {
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
                    e.currentTarget.style.transform = 'translateX(2px)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(99,102,241,0.1)' }}>
                    {locked
                      ? <Lock size={16} style={{ color: '#f59e0b' }} />
                      : <BookOpen size={16} style={{ color: 'var(--accent)' }} />}
                  </div>
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {article.title}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {article.is_premium ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Premium
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      Bepul
                    </span>
                  )}

                  {locked ? (
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#f59e0b' }}>
                      <Lock size={11} /> Premium
                    </span>
                  ) : article.file_url ? (
                    <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
                      O&apos;qish <ChevronRight size={13} />
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tez kunda</span>
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
