'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Lock, Crown } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Article {
  id: string
  title: string
  description: string | null
  content: string | null
  category: string
  level: string
  read_time: number
  is_premium: boolean
  word_count: number | null
  created_at: string
}

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
  intermediate: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  advanced:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
}

export function ArticleClient({ article, isPremium }: { article: Article; isPremium: boolean }) {
  const router = useRouter()
  const { t } = useLanguage()
  const locked = article.is_premium && !isPremium
  const lvlStyle = LEVEL_COLORS[article.level] ?? LEVEL_COLORS.intermediate

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push('/articles')}
        className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={16} /> {t('premium.backToArticles')}
      </button>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
          style={{ background: lvlStyle.bg, color: lvlStyle.color }}>
          {article.level}
        </span>
        <span className="text-xs capitalize px-2 py-0.5 rounded-md"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          {article.category}
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Clock size={12} /> {article.read_time} min
        </span>
        {article.word_count && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {article.word_count} so&apos;z
          </span>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-3 leading-snug" style={{ color: 'var(--text-primary)' }}>
        {article.title}
      </h1>

      {article.description && (
        <p className="text-base mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {article.description}
        </p>
      )}

      <hr style={{ borderColor: 'var(--border)', marginBottom: '24px' }} />

      {/* Content */}
      {locked ? (
        <div className="relative rounded-2xl overflow-hidden">
          {/* Blurred preview */}
          <div style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', maxHeight: '200px', overflow: 'hidden' }}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {article.content?.slice(0, 500) ?? ''}
            </p>
          </div>
          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(to top, var(--bg-primary) 60%, transparent)' }}>
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(245,158,11,0.15)' }}>
                <Crown size={28} style={{ color: '#f59e0b' }} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
                {t('premium.articleLockTitle')}
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {t('premium.articleLockDesc')}
              </p>
              <button
                onClick={() => router.push('/premium')}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
              >
                <Lock size={14} /> {t('premium.getBtn')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="text-sm leading-8 whitespace-pre-wrap"
          style={{ color: 'var(--text-secondary)' }}
        >
          {article.content ?? t('premium.noContent')}
        </div>
      )}
    </div>
  )
}
