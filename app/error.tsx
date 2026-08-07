'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t('errorPage.somethingWentWrong')}</h2>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>{error.message}</p>
      <button onClick={reset} className="btn-primary">{t('errorPage.tryAgain')}</button>
    </div>
  )
}
