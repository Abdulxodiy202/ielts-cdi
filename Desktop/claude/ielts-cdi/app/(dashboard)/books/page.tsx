'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Book {
  id: string
  title: string
  author: string | null
  heyzine_url: string
  cover_image_url: string | null
  recommendation: string | null
  is_premium: boolean
  is_published: boolean
  created_at: string
}

const COVER_GRADIENTS = [
  'linear-gradient(160deg, #312e81 0%, #4f46e5 60%, #7c3aed 100%)',
  'linear-gradient(160deg, #134e4a 0%, #0d9488 60%, #06b6d4 100%)',
  'linear-gradient(160deg, #831843 0%, #db2777 60%, #f472b6 100%)',
  'linear-gradient(160deg, #14532d 0%, #16a34a 60%, #4ade80 100%)',
  'linear-gradient(160deg, #78350f 0%, #d97706 60%, #fbbf24 100%)',
]

function bookColor(id: string, arr: string[]) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return arr[n % arr.length]
}

export default function BooksPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [books, setBooks]       = useState<Book[]>([])
  const [loading, setLoading]   = useState(true)
  const [isPremium, setIsPremium] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single()
        .then(({ data }) => setIsPremium(isActivePremium(data)))
    })
    fetch('/api/books')
      .then(async r => { const d = await r.json().catch(() => []); if (Array.isArray(d)) setBooks(d) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-8"
      style={{ background: 'var(--bg-primary)' }}>
      {/* shelf background strip */}
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{t('books.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('books.subtitle')}</p>
        </div>

        {books.length === 0 ? (
          <div className="py-20 text-center rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <p className="font-medium">{t('books.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {books.map(book => {
              const locked = book.is_premium && !isPremium
              const gradient = bookColor(book.id, COVER_GRADIENTS)

              return (
                <div key={book.id} className="flex flex-col gap-3">
                  {/* 3‑D book */}
                  <div style={{ perspective: '900px' }}>
                    <div
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: 'rotateY(0deg)',
                        transition: 'transform 0.35s ease',
                        cursor: locked ? 'default' : 'pointer',
                        borderRadius: 10,
                        boxShadow: '-6px 6px 20px rgba(0,0,0,0.35)',
                        height: 220,
                        position: 'relative',
                        overflow: 'hidden',
                        background: gradient,
                      }}
                      onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLDivElement).style.transform = 'rotateY(-20deg)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'rotateY(0deg)' }}
                      onClick={() => !locked && router.push(`/books/${book.id}`)}
                    >
                      {/* Cover */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                      }}>
                        {book.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={book.cover_image_url} alt={book.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 8 }}>
                            <div style={{ fontSize: 32, opacity: 0.4 }}>📖</div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.3 }}>
                              {book.title}
                            </p>
                          </div>
                        )}

                        {/* Premium badge */}
                        {book.is_premium && (
                          <div style={{ position: 'absolute', top: 8, right: 8 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
                              background: 'rgba(245,158,11,0.92)', color: 'white', whiteSpace: 'nowrap',
                            }}>
                              👑 {t('common.premium')}
                            </span>
                          </div>
                        )}

                        {/* Lock overlay */}
                        {locked && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: '50%',
                              background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Lock size={18} color="white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Below book: info + button */}
                  <div>
                    <p className="font-semibold text-sm leading-snug mb-0.5"
                      style={{ color: 'var(--text-primary)' }}>
                      {book.title}
                    </p>
                    {book.author && (
                      <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{book.author}</p>
                    )}
                    {book.recommendation && (
                      <div className="flex gap-1.5 mb-2">
                        <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>💡</span>
                        <p style={{
                          fontSize: 11,
                          color: '#ca8a04',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {book.recommendation}
                        </p>
                      </div>
                    )}
                    {locked ? (
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                      >
                        <Lock size={11} /> {t('books.premium')}
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/books/${book.id}`)}
                        className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold"
                        style={{ background: 'var(--accent)', color: 'white' }}
                      >
                        {t('books.read')} <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
