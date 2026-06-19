'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LinkingWordsPage() {
  const { t } = useLanguage()
  const router = useRouter()
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.linkingWords')}</span>
        </div>
        <button
          onClick={() => router.push('/vocabulary')}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} /> Vocabulary ga qaytish
        </button>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>🔗 {t('vocabulary.linkingWords')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.linkingWordsSubtitle')}</p>
      </div>
      <div className="py-20 text-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-5xl mb-4">🔗</div>
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{t('vocabulary.comingSoon')}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.linkingWordsDesc')}</p>
      </div>
    </div>
  )
}
