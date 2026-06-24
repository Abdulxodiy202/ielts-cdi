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
      .eq('is_published', true)
      .single(),
    supabase.from('profiles').select('is_premium, premium_until').eq('id', user.id).single(),
  ])

  if (!article) notFound()

  const isPremium = isActivePremium(profileRes.data)
  const locked = article.is_premium && !isPremium

  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <Lock size={28} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Premium kontent
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Bu maqolani o&apos;qish uchun Premium obuna kerak
          </p>
        </div>
        <Link href="/pricing"
          className="btn-primary px-6 py-2.5 text-sm font-semibold">
          Premium olish
        </Link>
      </div>
    )
  }

  if (!article.file_url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Maqola fayli hali yuklanmagan</p>
        <Link href="/articles" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          ← Orqaga
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
        <Link href="/articles"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
        </Link>
        <h1 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
          {article.title}
        </h1>
        {article.is_premium && (
          <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
            Premium
          </span>
        )}
      </div>

      {/* Iframe viewer */}
      <iframe
        src={article.file_url}
        className="flex-1 w-full border-0"
        title={article.title}
        allowFullScreen
      />
    </div>
  )
}
