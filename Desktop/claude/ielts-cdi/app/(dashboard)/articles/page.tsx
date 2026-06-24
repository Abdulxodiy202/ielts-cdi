'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Lock, BookOpen, ChevronRight, Beaker, Cpu, Globe, Briefcase, Leaf } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'

interface Article {
  id: string
  title: string
  description: string | null
  category: string
  level: string
  read_time: number
  is_premium: boolean
  cover_image: string | null
  word_count: number | null
  created_at: string
}

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
  intermediate: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  advanced:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  science:     Beaker,
  technology:  Cpu,
  culture:     Globe,
  business:    Briefcase,
  environment: Leaf,
  general:     BookOpen,
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  science:     'linear-gradient(135deg,#1e3a8a,#3b82f6)',
  technology:  'linear-gradient(135deg,#1e1b4b,#6366f1)',
  culture:     'linear-gradient(135deg,#4a1d96,#a855f7)',
  business:    'linear-gradient(135deg,#0f172a,#334155)',
  environment: 'linear-gradient(135deg,#064e3b,#10b981)',
  general:     'linear-gradient(135deg,#1e3a5f,#2563eb)',
}

const LEVELS = ['all', 'beginner', 'intermediate', 'advanced'] as const

export default function ArticlesPage() {
  const router = useRouter()
  const [articles, setArticles]       = useState<Article[]>([])
  const [loading, setLoading]         = useState(true)
  const [isPremium, setIsPremium]     = useState(false)
  const [levelFilter, setLevelFilter] = useState<string>('all')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single()
        .then(({ data }) => setIsPremium(isActivePremium(data)))
    })

    fetch('/api/articles')
      .then(async r => {
        const data = await r.json().catch(() => [])
        if (Array.isArray(data)) setArticles(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = levelFilter === 'all'
    ? articles
    : articles.filter(a => a.level === levelFilter)

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Maqolalar</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>IELTS uchun foydali inglizcha maqolalar</p>
      </div>

      {/* Level filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {LEVELS.map(lvl => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={levelFilter === lvl
              ? { background: 'var(--accent)', color: 'white' }
              : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
            }
          >
            {lvl === 'all' ? 'Barchasi' : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <BookOpen size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
            {articles.length === 0 ? 'Hali maqolalar qo\'shilmagan' : 'Bu darajada maqola topilmadi'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(article => {
            const locked = article.is_premium && !isPremium
            const CatIcon = CATEGORY_ICONS[article.category] ?? BookOpen
            const gradient = CATEGORY_GRADIENTS[article.category] ?? CATEGORY_GRADIENTS.general
            const lvlStyle = LEVEL_COLORS[article.level] ?? LEVEL_COLORS.intermediate

            return (
              <div
                key={article.id}
                className="rounded-xl overflow-hidden transition-all cursor-pointer group"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                onClick={() => !locked && router.push(`/articles/${article.id}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)' }}
              >
                {/* Cover */}
                <div className="h-32 relative flex items-center justify-center" style={{ background: gradient }}>
                  <CatIcon size={40} color="rgba(255,255,255,0.3)" />
                  {article.is_premium && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(245,158,11,0.9)', color: 'white' }}>
                      <Lock size={10} /> Premium
                    </div>
                  )}
                  {locked && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
                      <Lock size={28} color="white" />
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                      style={{ background: lvlStyle.bg, color: lvlStyle.color }}>
                      {article.level}
                    </span>
                    <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                      {article.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm leading-snug mb-1.5 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                    {article.title}
                  </h3>

                  {article.description && (
                    <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {article.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={12} /> {article.read_time} min
                    </span>
                    {locked ? (
                      <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#f59e0b' }}>
                        <Lock size={11} /> Premium
                      </span>
                    ) : (
                      <span className="text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all"
                        style={{ color: 'var(--accent)' }}>
                        O&apos;qish <ChevronRight size={13} />
                      </span>
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
