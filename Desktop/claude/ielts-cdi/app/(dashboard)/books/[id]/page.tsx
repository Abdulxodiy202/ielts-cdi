export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { isActivePremium } from '@/lib/utils/premium'
import Link from 'next/link'
import { ArrowLeft, Lock } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BookPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: book }, profileRes] = await Promise.all([
    admin.from('books')
      .select('id, title, author, heyzine_url, is_premium, is_published')
      .eq('id', id)
      .eq('is_published', true)
      .single(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  if (!book) notFound()

  const isPremium = isActivePremium(profileRes.data)
  const locked = book.is_premium && !isPremium

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Lock size={28} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Premium kontent</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Bu kitobni o&apos;qish uchun Premium obuna kerak
          </p>
        </div>
        <Link href="/pricing" className="btn-primary px-6 py-2.5 text-sm font-semibold">Premium olish</Link>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Slim top bar — 48px, same pattern as ReadingTestClient */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          height: 48,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Link
          href="/books"
          className="btn-outline text-sm flex items-center gap-1.5 shrink-0"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Orqaga</span>
        </Link>
        <h1
          className="font-bold text-sm sm:text-base truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {book.title}
        </h1>
        {book.author && (
          <span
            className="text-xs hidden sm:block shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {book.author}
          </span>
        )}
        {book.is_premium && (
          <span
            className="shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(245,158,11,0.12)',
              color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            Premium
          </span>
        )}
      </div>

      {/* Heyzine iframe — fills remaining height */}
      <iframe
        src={book.heyzine_url}
        title={book.title}
        allowFullScreen
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  )
}
