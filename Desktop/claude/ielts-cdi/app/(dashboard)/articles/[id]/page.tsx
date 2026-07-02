export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { isActivePremium } from '@/lib/utils/premium'
import Link from 'next/link'
import { BackButton } from '@/components/ui/BackButton'
import MusicPlayer from '@/components/MusicPlayer'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: article }, profileRes] = await Promise.all([
    admin.from('articles')
      .select('id, title, file_url, is_premium, is_published')
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  if (!article || !article.is_published) notFound()

  const isPremium = isActivePremium(profileRes.data)
  const locked = article.is_premium && !isPremium

  if (locked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32, textAlign: 'center', gap: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 32 }}>
          🔒
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Bu maqola Premium foydalanuvchilar uchun
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Barcha premium maqolalarni o&apos;qish uchun Premium tarifga o&apos;ting
          </p>
        </div>
        <Link
          href="/dashboard?showPayment=true"
          style={{ padding: '12px 28px', borderRadius: 12, fontWeight: 700, fontSize: 15, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', textDecoration: 'none', display: 'inline-block' }}
        >
          👑 Premiumga o&apos;tish
        </Link>
        <Link href="/articles" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
          ← Maqolalarga qaytish
        </Link>
      </div>
    )
  }

  if (!article.file_url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{/* articles.noFile — static fallback */}Maqola fayli hali yuklanmagan</p>
        <BackButton href="/articles" />
      </div>
    )
  }

  const TOPBAR_H = 52

  return (
    <>
      {/* Fixed top bar */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: TOPBAR_H, zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 16px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <BackButton href="/articles" />
        <h1
          style={{
            fontSize: 14, fontWeight: 600, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: 'var(--text-primary)',
          }}
        >
          {article.title}
        </h1>
        {article.is_premium && (
          <span
            style={{
              fontSize: 11, fontWeight: 700, padding: '2px 10px',
              borderRadius: 20, flexShrink: 0,
              background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            {/* same word both langs */}Premium
          </span>
        )}
      </div>

      {/* Full-screen iframe below topbar */}
      <iframe
        src={article.file_url}
        title={article.title}
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
      <MusicPlayer autoPlay defaultMinimized />
    </>
  )
}
