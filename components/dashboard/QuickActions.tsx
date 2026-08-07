'use client'

import Link from 'next/link'
import { BookOpen, Headphones, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface QuickActionsProps {
  readingTotal: number
  readingFree: number
  listeningTotal: number
  listeningFree: number
}

export function QuickActions({ readingTotal, readingFree, listeningTotal, listeningFree }: QuickActionsProps) {
  const { t } = useLanguage()
  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-8">
      <Link
        href="/reading"
        className="card p-6 flex items-center justify-between group hover:border-[var(--accent)] transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <BookOpen size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.readingTests')}</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('dashboard.testsFree', { total: readingTotal, free: readingFree })}
            </div>
          </div>
        </div>
        <ArrowRight size={20} style={{ color: 'var(--text-muted)' }} className="group-hover:translate-x-1 transition-transform" />
      </Link>

      <Link
        href="/listening"
        className="card p-6 flex items-center justify-between group hover:border-[var(--accent)] transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <Headphones size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('dashboard.listeningTests')}</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('dashboard.testsFree', { total: listeningTotal, free: listeningFree })}
            </div>
          </div>
        </div>
        <ArrowRight size={20} style={{ color: 'var(--text-muted)' }} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  )
}
