'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { isAdmin } from '@/lib/admin-config'
import { formatTime } from '@/lib/utils/formatters'
import { Headphones, Lock, Star, ChevronLeft } from 'lucide-react'

interface ScriptProgress {
  script_id: number
  best_accuracy: number
  best_stars: number
  is_completed: boolean
  attempts: number
}

interface Script {
  id: number
  title: string
  description: string | null
  thumbnail_url: string | null
  duration_seconds: number | null
  order_index: number
  is_premium: boolean
  is_active: boolean
  progress: ScriptProgress | null
}

const PASS_THRESHOLD = 70

export default function ScriptListPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [authChecked, setAuthChecked] = useState(false)
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserIsAdmin(isAdmin(user.email))
      setAuthChecked(true)
    })
  }, [router])

  useEffect(() => {
    if (!authChecked) return
    fetch('/api/script/list').then(async res => {
      if (!res.ok) { setError('genericError'); setLoading(false); return }
      setScripts(await res.json())
      setLoading(false)
    }).catch(() => { setError('genericError'); setLoading(false) })
  }, [authChecked])

  const totalStars = scripts.reduce((sum, s) => sum + (s.progress?.best_stars ?? 0), 0)
  const maxStars = scripts.length * 5

  function isUnlocked(index: number): boolean {
    if (userIsAdmin) return true
    if (index === 0) return true
    const prev = scripts[index - 1]
    return (prev.progress?.best_accuracy ?? 0) >= PASS_THRESHOLD
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Link href="/listening" className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
        <ChevronLeft size={16} /> {t('test.backToModes')}
      </Link>

      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('script.title')}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t('script.listSubtitle')}</p>
        </div>
        <span
          className="text-sm font-semibold px-3 py-1.5 rounded-full shrink-0"
          style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--premium)', border: '1px solid rgba(245,158,11,0.3)' }}
        >
          ⭐ {totalStars}/{maxStars}
        </span>
      </div>

      {error && (
        <div className="card p-8 text-center" style={{ color: 'var(--error)' }}>{t('script.loadError')}</div>
      )}

      {!error && scripts.length === 0 && (
        <div className="card p-16 text-center">
          <div className="text-4xl mb-3">🎧</div>
          <p style={{ color: 'var(--text-muted)' }}>{t('script.noScripts')}</p>
        </div>
      )}

      {!error && scripts.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {scripts.map((script, i) => {
            const unlocked = isUnlocked(i)
            const progress = script.progress
            const content = (
              <>
                <div className="relative w-full aspect-video rounded-t-2xl overflow-hidden shrink-0">
                  {script.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={script.thumbnail_url} alt={script.title} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))' }}
                    >
                      <Headphones size={40} style={{ color: 'rgba(16,185,129,0.6)' }} />
                    </div>
                  )}
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}>
                      <Lock size={28} style={{ color: '#fff' }} />
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-2">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {script.order_index}. {script.title}
                  </h3>
                  {script.description && (
                    <p
                      className="text-xs leading-relaxed"
                      style={{
                        color: 'var(--text-muted)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {script.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {script.duration_seconds != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        {formatTime(script.duration_seconds)}
                      </span>
                    )}
                    {script.is_premium ? (
                      <span className="badge-premium text-xs">👑 {t('test.premium')}</span>
                    ) : (
                      <span className="badge-free text-xs">{t('test.free')}</span>
                    )}
                  </div>

                  {progress && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold" style={{ color: progress.best_accuracy >= PASS_THRESHOLD ? 'var(--success)' : 'var(--text-muted)' }}>
                        {progress.best_accuracy}%
                      </span>
                      <span className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, si) => (
                          <Star key={si} size={11} fill={si < progress.best_stars ? '#f59e0b' : 'none'} style={{ color: si < progress.best_stars ? '#f59e0b' : 'var(--border)' }} />
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )

            return unlocked ? (
              <Link
                key={script.id}
                href={`/listening/script/${script.id}`}
                className="card overflow-hidden flex flex-col hover:opacity-90 transition-opacity"
                style={{ padding: 0 }}
              >
                {content}
              </Link>
            ) : (
              <div key={script.id} className="card overflow-hidden flex flex-col opacity-75 cursor-not-allowed" style={{ padding: 0 }}>
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
