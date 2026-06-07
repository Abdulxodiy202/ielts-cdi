'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Crown, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PaymentModal } from '@/components/PaymentModal'

export default function PremiumPage() {
  const router = useRouter()
  const supabase = createClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [initialName, setInitialName] = useState('')
  const [initialPhone, setInitialPhone] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setInitialName(data.full_name ?? '')
            setInitialPhone(data.phone ?? '')
          }
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8"
          style={{ border: '2px solid var(--accent)' }}
        >
          {success ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle
                  size={60}
                  className="mx-auto mb-4"
                  style={{ color: 'var(--success)' }}
                />
              </motion.div>
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                So&apos;rovingiz qabul qilindi! 🎉
              </h2>
              <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
                To&apos;lovingiz tekshirilgach, 24 soat ichida premium faollashtiriladi.
              </p>
              <Link href="/dashboard" className="btn-primary w-full flex justify-center">
                Dashboardga qaytish
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <Crown size={40} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
                <h1
                  className="text-2xl font-bold mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  IELTS CDI Premium
                </h1>
                <div className="text-4xl font-black my-3" style={{ color: 'var(--accent)' }}>
                  119,000 UZS
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  oyiga · istalgan vaqt bekor qilish
                </p>
              </div>

              {[
                '5 ta Premium Reading Testi (5–9)',
                '5 ta Premium Listening Testi (5–9)',
                "Mock Test Bron qilish (20,000 UZS/sessiya)",
                "To'liq tahlil va band kuzatuvi",
                'Ustuvor qo\'llab-quvvatlash',
              ].map((f) => (
                <div key={f} className="flex items-start gap-3 mb-3">
                  <CheckCircle
                    size={16}
                    className="shrink-0 mt-0.5"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {f}
                  </span>
                </div>
              ))}

              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary w-full text-base mt-6"
              >
                <Crown size={18} />
                Upgrade Now
              </button>

              <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                To&apos;lovdan keyin 24 soat ichida faollashtiriladi
              </p>
            </>
          )}
        </motion.div>
      </div>

      <PaymentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); setSuccess(true) }}
        type="premium"
        amount={119000}
        initialName={initialName}
        initialPhone={initialPhone}
      />
    </div>
  )
}
