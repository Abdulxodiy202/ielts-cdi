'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { PaymentModal } from '@/components/PaymentModal'

interface Article {
  id: string
  title: string
  file_url: string | null
  is_premium: boolean
  is_published: boolean
}

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [isPremiumUser, setIsPremiumUser] = useState(false)
  const [initialName, setInitialName] = useState('')
  const [initialPhone, setInitialPhone] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [res, profileRes] = await Promise.all([
        fetch(`/api/articles/${id}`),
        supabase.from('profiles').select('is_premium, premium_until, full_name, phone').eq('id', user.id).single(),
      ])

      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setArticle(data)
      setIsPremiumUser(isActivePremium(profileRes.data))
      setInitialName(profileRes.data?.full_name ?? '')
      setInitialPhone((profileRes.data as any)?.phone ?? '')
      setLoading(false)
    }
    load()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p style={{ color: 'var(--text-muted)' }}>Maqola topilmadi</p>
        <button onClick={() => router.push('/articles')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Maqolalarga qaytish
        </button>
      </div>
    )
  }

  // PREMIUM LOCK — overlay, redirect yo'q
  if (article.is_premium && !isPremiumUser) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🔒</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          Bu maqola Premium foydalanuvchilar uchun
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32, maxWidth: 400 }}>
          Barcha premium maqolalarni o&apos;qish uchun Premium tarifga o&apos;ting
        </p>
        <button
          onClick={() => setShowPayment(true)}
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white',
            border: 'none',
            padding: '14px 32px',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          👑 Premiumga o&apos;tish — 50,000 so&apos;m/oy
        </button>
        <button
          onClick={() => router.push('/articles')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          ← Maqolalarga qaytish
        </button>

        <PaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          onSuccess={() => setShowPayment(false)}
          type="premium"
          amount={50000}
          initialName={initialName}
          initialPhone={initialPhone}
        />
      </div>
    )
  }

  // Premium user — PDF ko'rsat
  if (!article.file_url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p style={{ color: 'var(--text-muted)' }}>Maqola fayli hali yuklanmagan</p>
        <button onClick={() => router.push('/articles')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← Maqolalarga qaytish
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push('/articles')}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}
        >
          ← {article.title}
        </button>
      </div>
      <iframe
        src={article.file_url}
        style={{ flex: 1, border: 'none', width: '100%' }}
        title={article.title}
        allowFullScreen
      />
    </div>
  )
}
