'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { isActivePremium } from '@/lib/utils/premium'
import { PremiumLockModal } from '@/components/PremiumLockModal'

const PaymentModal = dynamic(() => import('@/components/PaymentModal').then(m => ({ default: m.PaymentModal })), { ssr: false })

// Client-side premium gate. Renders a lock screen for free users when
// isPremiumContent is true. Server-side gates are still the source of
// truth -- this component only improves UX (nice error over blank fetch
// failure).
//
// Ilovadagi BARCHA boshqa premium qulflar bilan bir xil ko'rinish --
// kichik markazlashgan PremiumLockModal (Reading/Listening test
// ro'yxatidagi original dizayn). Avval bu yerda alohida katta "to'liq
// sahifa" hero-uslubidagi qulf ekrani bor edi -- foydalanuvchi buni
// "boshqa oynaga o'tkazib yuboryapti" deb his qildi, chunki u boshqa
// joylardagi kichik popup'lardan farqli ko'rinardi. Endi hammasi bir xil.
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
  const [showPaymentModal, setShowPaymentModal] = useState(false)

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
      <div className="min-h-[60vh]" style={{ background: 'var(--bg-primary)' }}>
        <PremiumLockModal
          open
          onClose={() => router.back()}
          onUpgrade={() => setShowPaymentModal(true)}
          title={`Premium ${contentType}`}
          description="Bu material Premium foydalanuvchilar uchun. Premium'ga o'tib barcha materiallardan cheklovsiz foydalaning."
          cancelLabel="Bekor qilish"
          upgradeLabel="Premium'ga o'tish"
        />

        {showPaymentModal && (
          <PaymentModal
            isOpen
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => setShowPaymentModal(false)}
            type="premium"
            amount={50000}
          />
        )}
      </div>
    )
  }

  return <>{children}</>
}
