'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function SpeakingVocabPage() {
  const router = useRouter()
  const { t } = useLanguage()
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            {t('vocabCard.backToVocab')}
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.speakingPhrases')}</span>
        </div>
        <button
          onClick={() => router.push('/vocabulary')}
          className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} /> {t('vocabCard.backToVocabBtn')}
        </button>

        <div className="flex items-start gap-4 mb-8">
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>🎤</div>
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('vocabulary.speakingPhrases')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('vocabulary.speakingPhrasesDesc')}
            </p>
          </div>
        </div>
      </div>

      <div className="py-20 text-center rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-5xl mb-4">🚀</div>
        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('vocabulary.comingSoon')}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('vocabulary.speakingComingSoonDesc')}
        </p>
      </div>
    </div>
  )
}
