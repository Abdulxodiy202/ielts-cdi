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

  const TOPBAR_H = 52

  return (
    <>
      {/* Fixed top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: TOPBAR_H, zIndex: 200,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}>
        <Link href="/books" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'var(--bg-secondary)', color: 'var(--text-muted)',
        }}>
          <ArrowLeft size={16} />
        </Link>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <h1 style={{
            fontSize: 14, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: 'var(--text-primary)',
          }}>
            {book.title}
          </h1>
          {book.author && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{book.author}</p>
          )}
        </div>
        {book.is_premium && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 10px',
            borderRadius: 20, flexShrink: 0,
            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.3)',
          }}>
            Premium
          </span>
        )}
      </div>

      {/* Full-screen Heyzine iframe */}
      <iframe
        src={book.heyzine_url}
        title={book.title}
        allowFullScreen
        style={{
          position: 'fixed',
          top: TOPBAR_H, left: 0, right: 0, bottom: 0,
          width: '100%',
          height: `calc(100vh - ${TOPBAR_H}px)`,
          border: 'none',
          zIndex: 200,
          display: 'block',
        }}
      />
    </>
  )
}
