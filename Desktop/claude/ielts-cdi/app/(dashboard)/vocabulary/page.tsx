'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function VocabularyPage() {
  const { t } = useLanguage()
  const [lwCount, setLwCount] = useState<number | null>(null)
  const [wcCount, setWcCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/vocabulary/linking-words')
      .then(r => r.ok ? r.json() : {})
      .then((d: { words?: unknown[] }) => setLwCount(d.words?.length ?? 0))
      .catch(() => {})
    fetch('/api/vocabulary/writing-collocations')
      .then(r => r.ok ? r.json() : {})
      .then((d: { words?: unknown[] }) => setWcCount(d.words?.length ?? 0))
      .catch(() => {})
  }, [])

  const CATEGORIES = [
    {
      href: '/vocabulary/games',
      emoji: '🎮',
      title: 'O\'yinlar',
      desc:  '100 darajali so\'z o\'yini — har darajada 5 ta savol',
      count: '100 daraja',
      color: '#8b5cf6',
      bg:    'rgba(139,92,246,0.08)',
      border:'rgba(139,92,246,0.25)',
    },
    {
      href: '/vocabulary/irregular-verbs',
      emoji: '🔄',
      titleKey: 'vocabulary.irregularVerbs',
      descKey:  'vocabulary.irregularVerbsDesc',
      count:    `150 ${t('vocabulary.verbs')}`,
      color: '#6366f1',
      bg:    'rgba(99,102,241,0.08)',
      border:'rgba(99,102,241,0.25)',
    },
    {
      href: '/vocabulary/library',
      emoji: '📖',
      titleKey: 'vocabulary.library',
      descKey:  'vocabulary.libraryDesc',
      count:    t('vocabulary.aiPowered'),
      color: '#10b981',
      bg:    'rgba(16,185,129,0.08)',
      border:'rgba(16,185,129,0.25)',
    },
    {
      href: '/vocabulary/reading',
      emoji: '📑',
      titleKey: 'vocabulary.readingVocab',
      descKey:  'vocabulary.readingVocabDesc',
      count:    t('vocabulary.perTest'),
      color: '#f59e0b',
      bg:    'rgba(245,158,11,0.08)',
      border:'rgba(245,158,11,0.25)',
    },
    {
      href: '/vocabulary/writing',
      emoji: '✍️',
      titleKey: 'vocabulary.writingCollocations',
      descKey:  'vocabulary.writingCollocationsDesc',
      count:    wcCount !== null ? `${wcCount} so'z` : '...',
      color: '#ec4899',
      bg:    'rgba(236,72,153,0.08)',
      border:'rgba(236,72,153,0.25)',
    },
    {
      href: '/vocabulary/linking-words',
      emoji: '🔗',
      titleKey: 'vocabulary.linkingWords',
      descKey:  'vocabulary.linkingWordsDesc',
      count:    lwCount !== null ? `${lwCount} so'z` : '...',
      color: '#14b8a6',
      bg:    'rgba(20,184,166,0.08)',
      border:'rgba(20,184,166,0.25)',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          📚 {t('vocabulary.title')}
        </h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>
          {t('vocabulary.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className="group block rounded-2xl p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
            style={{ background: cat.bg, border: `1px solid ${cat.border}` }}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{cat.emoji}</span>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}
              >
                {cat.count}
              </span>
            </div>
            <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              {(cat as any).title ?? t((cat as any).titleKey)}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {(cat as any).desc ?? t((cat as any).descKey)}
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: cat.color }}>
              {t('vocabulary.open')} <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
