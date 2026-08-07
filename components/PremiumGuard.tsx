'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Crown, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'

// Client-side premium gate. Renders a lock screen for free users when
// isPremiumContent is true. Server-side gates are still the source of
// truth -- this component only improves UX (nice error over blank fetch
// failure) and shortcut-navigates users directly to /premium.
//
// If isPremiumContent is unknown at first, pass null: the guard waits
// (spinner) until you supply the flag. Once supplied, it fetches the
// profile and either renders children or the lock screen.

interface PremiumGuardProps {
  // true: premium-only, must gate. false: free, no gating.
  // null/undefined: still loading -> render spinner.
  isPremiumContent: boolean | null | undefined
  contentType?: string
  children: React.ReactNode
}

export function PremiumGuard({
  isPremiumContent,
  contentType = 'material',
  children,
}: PremiumGuardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      // Still don't know if content is premium -- wait, keep spinner.
      if (isPremiumContent === null || isPremiumContent === undefined) return

      // Free content: everyone in.
      if (!isPremiumContent) {
        if (!cancelled) {
          setHasAccess(true)
          setLoading(false)
        }
        return
      }

      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await sb
        .from('profiles')
        .select('is_premium, premium_until')
        .eq('id', user.id)
        .single()

      if (cancelled) return
      setHasAccess(isActivePremium(profile))
      setLoading(false)
    }

    void check()
    return () => { cancelled = true }
  }, [isPremiumContent, router])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 md:p-6" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="max-w-md w-full text-center rounded-3xl p-8 md:p-10"
          style={{
            background: 'linear-gradient(160deg, rgba(245,158,11,0.10), rgba(30,30,40,0.85))',
            border: '1px solid rgba(245,158,11,0.30)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          }}
        >
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.15))',
              border: '1px solid rgba(245,158,11,0.40)',
            }}
          >
            <Lock size={40} style={{ color: '#F59E0B' }} />
          </div>

          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Premium {contentType}
          </h1>

          <p className="text-sm md:text-base mb-8 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Bu material Premium foydalanuvchilar uchun.
            Premium&apos;ga o&apos;tib barcha materiallardan cheklovsiz foydalaning.
          </p>

          <Link
            href="/premium"
            className="inline-flex items-center justify-center gap-2 w-full py-4 rounded-xl text-base font-semibold text-white transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
              boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
            }}
          >
            <Crown size={18} /> Premium&apos;ga o&apos;tish
          </Link>

          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 inline-flex items-center gap-1 text-sm hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={13} /> Orqaga qaytish
          </button>
        </motion.div>
      </div>
    )
  }

  return <>{children}</>
}
