'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Clock, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { PremiumGuard } from '@/components/PremiumGuard'
import dynamic from 'next/dynamic'

// MusicPlayer is 100% client (WebAudio + persistent volume/mute), only
// appears while reading — dynamic keeps it out of the article shell.
const MusicPlayer = dynamic(() => import('@/components/MusicPlayer'), { ssr: false })
import { CATEGORY_COLOR, CATEGORY_LABEL, articleCategoryFor, articleReadMinutesFor } from '@/lib/utils/articleCategory'
import { difficultyColor } from '@/lib/utils/articleDifficulty'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Article ochish sahifasi (crackd.it uslubi). Endi kontent
// articles.content ustunidagi markdown -- iframe/PDF logikasi
// olib tashlangan. Old header'da Exit/Title/Practice, tanadagi
// meta chiplari, so'ng markdown, oxirida Start Practice CTA.
// Highlighter/Practice paneli hozircha yo'q (keyingi bosqichlar).

interface Article {
  id: string
  title: string
  category: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  read_time: number | null
  description: string | null
  content: string | null
  source_text: string | null
  source_url: string | null
  has_test: boolean
  is_premium: boolean
  created_at: string
}

const DIFFICULTY_KEY: Record<string, string> = {
  easy: 'articles.difficulty.easy',
  medium: 'articles.difficulty.medium',
  hard: 'articles.difficulty.hard',
}

function formatDate(dateStr: string, lang: 'en' | 'uz'): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'uz-UZ', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(dateStr))
}

export default function ArticlePage() {
  const { t, lang } = useLanguage()
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()

  const [article, setArticle] = useState<Article | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [practiceOpen, setPracticeOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [res, profileRes] = await Promise.all([
        fetch(`/api/articles/${id}`),
        supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
      ])

      if (!res.ok) { setNotFound(true); setLoading(false); return }
      const data = (await res.json()) as Article
      setArticle(data)
      setIsPremium(isActivePremium(profileRes.data))
      setLoading(false)
    }
    void load()
  }, [id, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <div>
          <p className="mb-4">{t('articles.notFoundFull')}</p>
          <button
            type="button"
            onClick={() => router.push('/articles')}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('articles.backToArticles')}
          </button>
        </div>
      </div>
    )
  }

  const category = articleCategoryFor(article)
  const catColor = CATEGORY_COLOR[category]
  const diffColor = difficultyColor(article.difficulty)
  const mins = articleReadMinutesFor(article)
  const diffKey = article.difficulty ?? 'easy'

  return (
    <PremiumGuard isPremiumContent={article.is_premium} contentType="Article">
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        {/* Top bar */}
        <div
          className="sticky top-0 z-40 px-4 md:px-6 py-3 flex items-center justify-between gap-3"
          style={{
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Chiqish tugmasi -- to'liq huquqli button (matn/link emas) */}
          <button
            type="button"
            onClick={() => router.push('/articles')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-secondary)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg-card)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <X size={16} /> {t('articles.exit')}
          </button>

          <h1
            className="text-sm md:text-base font-semibold truncate flex-1 text-center"
            style={{ color: 'var(--text-primary)' }}
          >
            {article.title}
          </h1>

          <button
            type="button"
            onClick={() => setPracticeOpen(true)}
            disabled={!article.has_test}
            className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <ClipboardCheck size={15} style={{ color: '#22c55e' }} />
            <span className="hidden sm:inline">{t('articles.practice')}</span>
          </button>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-10">
          {/* Meta chiplari */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap mb-6">
            <span
              className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wide"
              style={{ background: catColor.bg, color: catColor.accent, border: `1px solid ${catColor.border}` }}
            >
              {CATEGORY_LABEL[category]}
            </span>
            <span
              className="inline-block px-3 py-1 rounded text-xs font-semibold"
              style={{ background: diffColor.accentBg, color: diffColor.accent, border: `1px solid ${diffColor.accentBorder}` }}
            >
              {t(DIFFICULTY_KEY[diffKey])}
            </span>
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Clock size={12} /> {mins} min
            </span>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {formatDate(article.created_at, lang)}
            </span>
          </div>

          {/* Sarlavha */}
          <h1
            className="text-3xl md:text-4xl font-bold mb-8"
            style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}
          >
            {article.title}
          </h1>

          {/* Markdown body -- react-markdown + remark-gfm.
              prose class'lari o'rniga bevosita element style'lar,
              chunki Tailwind typography plugin qo'shilmagan va
              dark-only palette bilan matn kontrasti barqaror kerak. */}
          {article.content && article.content.trim() ? (
            <div
              className="markdown-body"
              style={{
                color: 'var(--text-secondary)',
                fontSize: 16,
                lineHeight: 1.75,
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {article.content}
              </ReactMarkdown>
              <style>{`
                .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
                  color: var(--text-primary);
                  font-weight: 700;
                  line-height: 1.3;
                  margin: 1.75em 0 0.75em;
                }
                .markdown-body h1 { font-size: 2rem; }
                .markdown-body h2 { font-size: 1.5rem; }
                .markdown-body h3 { font-size: 1.25rem; }
                .markdown-body h4 { font-size: 1.1rem; }
                .markdown-body p { margin: 1em 0; }
                .markdown-body strong { color: var(--text-primary); font-weight: 700; }
                .markdown-body em { font-style: italic; }
                .markdown-body a {
                  color: var(--accent);
                  text-decoration: underline;
                  text-underline-offset: 3px;
                }
                .markdown-body a:hover { opacity: 0.85; }
                .markdown-body ul, .markdown-body ol {
                  margin: 1em 0;
                  padding-left: 1.5em;
                }
                .markdown-body ul { list-style: disc; }
                .markdown-body ol { list-style: decimal; }
                .markdown-body li { margin: 0.35em 0; }
                .markdown-body blockquote {
                  border-left: 3px solid var(--accent);
                  padding: 0.25em 1em;
                  margin: 1em 0;
                  color: var(--text-muted);
                  font-style: italic;
                }
                .markdown-body code {
                  background: var(--bg-card);
                  border: 1px solid var(--border);
                  border-radius: 6px;
                  padding: 0.1em 0.4em;
                  font-size: 0.9em;
                  color: var(--text-primary);
                }
                .markdown-body pre {
                  background: var(--bg-card);
                  border: 1px solid var(--border);
                  border-radius: 10px;
                  padding: 1em;
                  overflow-x: auto;
                  margin: 1em 0;
                }
                .markdown-body pre code {
                  background: transparent;
                  border: none;
                  padding: 0;
                }
                .markdown-body hr {
                  border: none;
                  border-top: 1px solid var(--border);
                  margin: 2em 0;
                }
                .markdown-body table {
                  border-collapse: collapse;
                  margin: 1em 0;
                  width: 100%;
                }
                .markdown-body th, .markdown-body td {
                  border: 1px solid var(--border);
                  padding: 0.5em 0.75em;
                }
                .markdown-body th { background: var(--bg-card); font-weight: 600; }
                .markdown-body img {
                  max-width: 100%;
                  border-radius: 10px;
                  margin: 1em 0;
                }
              `}</style>
            </div>
          ) : (
            <div
              className="rounded-2xl p-6 text-center italic text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {t('articles.noContentAdded')}
            </div>
          )}

          {/* Manba attribution -- source_text + source_url ikkalasi
              mavjud bo'lsa ko'rinadi. Kichik italik matn, yangi tabda
              ochiladi. */}
          {article.source_text && article.source_url && (
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm italic underline underline-offset-4 transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
              >
                {article.source_text}
              </a>
            </div>
          )}

          {/* Pastdagi Start Practice CTA */}
          {article.has_test && (
            <div className="mt-12 pt-8 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {t('articles.finishedPrompt')}
              </p>
              <button
                type="button"
                onClick={() => router.push(`/articles/${article.id}/test`)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                <ClipboardCheck size={18} /> {t('articles.startPractice')}
              </button>
            </div>
          )}

          {/* Practice paneli placeholder -- keyingi bosqichda to'liq qilamiz */}
          {practiceOpen && (
            <div
              className="mt-8 rounded-2xl p-5 text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {t('articles.practicePanelPlaceholder')}
              <button
                type="button"
                onClick={() => router.push(`/articles/${article.id}/test`)}
                className="ml-1 underline"
                style={{ color: 'var(--accent)' }}
              >
                {t('articles.goToFullTest')}
              </button>
              .
            </div>
          )}
        </div>
        {/* Fon musiqasi -- minimized ♪ pill sifatida past o'ng burchakda */}
        <MusicPlayer autoPlay defaultMinimized />
      </div>
    </PremiumGuard>
  )
}
