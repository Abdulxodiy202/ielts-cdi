import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const CATEGORIES = [
  {
    href: '/vocabulary/irregular-verbs',
    emoji: '🔄',
    title: 'Irregular Verbs',
    titleUz: 'Noto\'ri fe\'llar',
    desc: '150+ common irregular verbs with Uzbek translations, definitions and examples.',
    count: '150 verbs',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
  },
  {
    href: '/vocabulary/library',
    emoji: '📖',
    title: 'My Library',
    titleUz: 'Mening kutubxonam',
    desc: 'Save words to custom collections. AI-powered definitions and Uzbek translations.',
    count: 'AI powered',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
  },
  {
    href: '/vocabulary/reading',
    emoji: '📑',
    title: 'Reading Vocabulary',
    titleUz: 'Reading lug\'ati',
    desc: "Academic words from IELTS Reading tests. Build your passage vocabulary.",
    count: 'Per test',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
  },
  {
    href: '/vocabulary/writing',
    emoji: '✍️',
    title: 'Writing Collocations',
    titleUz: 'Writing kollokatsiyalar',
    desc: 'Essential collocations and phrases for IELTS Writing Task 1 and Task 2.',
    count: 'Coming soon',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
  },
  {
    href: '/vocabulary/linking-words',
    emoji: '🔗',
    title: 'Linking Words',
    titleUz: 'Bog\'lovchi so\'zlar',
    desc: 'Discourse markers and linking expressions to boost your coherence score.',
    count: 'Coming soon',
    color: '#14b8a6',
    bg: 'rgba(20,184,166,0.08)',
    border: 'rgba(20,184,166,0.25)',
  },
]

export default async function VocabularyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          📚 Vocabulary
        </h1>
        <p className="text-base" style={{ color: 'var(--text-muted)' }}>
          Master IELTS vocabulary with structured learning tools
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
            <h2 className="text-lg font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
              {cat.title}
            </h2>
            <p className="text-xs mb-3 font-medium" style={{ color: cat.color }}>
              {cat.titleUz}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {cat.desc}
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium" style={{ color: cat.color }}>
              Open <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
