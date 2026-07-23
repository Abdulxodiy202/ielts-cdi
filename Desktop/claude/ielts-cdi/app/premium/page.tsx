'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Crown, CheckCircle, ArrowLeft,
  BookOpen, Target, Bot, BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PaymentModal } from '@/components/PaymentModal'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Premium sahifasi -- xususiyatlar kategoriyalar bo'yicha ajratilgan.
// Ro'yxatlar bilingual (uz/en) va aktual platforma imkoniyatlariga
// mos: 30+ premium test, 100 vocab level, AI grading, Study Plan.

interface FeatureCategory {
  key: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
  title: { uz: string; en: string }
  items: { uz: string[]; en: string[] }
}

const CATEGORIES: FeatureCategory[] = [
  {
    key: 'tests',
    icon: BookOpen,
    color: '#6366f1',
    title: { uz: 'Testlar va mashqlar', en: 'Tests & Practice' },
    items: {
      uz: [
        '30+ Premium Reading testlari (bir oyga yetadi)',
        '30+ Premium Listening testlari (Full va Training with Sections)',
        "Barcha 10 ta Script Practice mashqlari",
        'Barcha 100 ta Vocabulary level (Games)',
        'Barcha 10 ta Video Darslar',
        "Barcha 30+ Article va Quiz",
      ],
      en: [
        '30+ Premium Reading tests (enough for a month)',
        '30+ Premium Listening tests (Full and Training with Sections)',
        'All 10 Script Practice exercises',
        'All 100 Vocabulary levels (Games)',
        'All 10 Video Lessons',
        'All 30+ Articles and Quizzes',
      ],
    },
  },
  {
    key: 'plan',
    icon: Target,
    color: '#a855f7',
    title: { uz: 'Shaxsiy reja', en: 'Personal Plan' },
    items: {
      uz: [
        'Har kuni AI tomonidan yangilanadigan Study Plan',
        'Kunlik va haftalik rejim tanlash',
        'Zaif tomonlaringizga qaratilgan mashqlar',
        'Streak va bonuslar tizimi',
      ],
      en: [
        'AI-updated Study Plan every day',
        'Choose daily or weekly mode',
        'Exercises targeted at your weak areas',
        'Streak and bonus rewards system',
      ],
    },
  },
  {
    key: 'ai',
    icon: Bot,
    color: '#10b981',
    title: { uz: 'AI yordami', en: 'AI Assistance' },
    items: {
      uz: [
        'Writing uchun AI baholash va band score',
        'Speaking uchun AI baholash',
        'Batafsil natija tahlili va tavsiyalar',
      ],
      en: [
        'AI grading and band score for Writing',
        'AI grading for Speaking',
        'Detailed result analysis and feedback',
      ],
    },
  },
  {
    key: 'extra',
    icon: BarChart3,
    color: '#ec4899',
    title: { uz: "Qo'shimcha", en: 'Extras' },
    items: {
      uz: [
        'Mock Test Booking (20,000 UZS/session)',
        "To'liq analytics va band tracking",
        'Cheksiz Typing Practice',
        'Priority support',
      ],
      en: [
        'Mock Test Booking (20,000 UZS/session)',
        'Full analytics and band tracking',
        'Unlimited Typing Practice',
        'Priority support',
      ],
    },
  },
]

export default function PremiumPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t, lang } = useLanguage()
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
      className="min-h-screen flex items-start justify-center p-4 md:p-6 py-10"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} /> {t('premiumPage.backToDashboard')}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 md:p-8"
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
                {t('premiumPage.requestReceivedTitle')}
              </h2>
              <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
                {t('premiumPage.requestReceivedDesc')}
              </p>
              <Link href="/dashboard" className="btn-primary w-full flex justify-center">
                {t('premiumPage.backToDashboardBtn')}
              </Link>
            </div>
          ) : (
            <>
              {/* Sarlavha + narx */}
              <div className="text-center mb-8">
                <Crown size={44} className="mx-auto mb-3" style={{ color: '#f59e0b' }} />
                <h1
                  className="text-2xl md:text-3xl font-bold mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  IELTS CDI Premium
                </h1>
                <div className="text-4xl md:text-5xl font-black my-3" style={{ color: 'var(--accent)' }}>
                  50,000 UZS
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('premiumPage.perMonth')}
                </p>
              </div>

              {/* Xususiyatlar -- kategoriyalar bo'yicha */}
              <div className="space-y-6 mb-6">
                {CATEGORIES.map((cat, idx) => {
                  const Icon = cat.icon
                  const items = lang === 'en' ? cat.items.en : cat.items.uz
                  const title = lang === 'en' ? cat.title.en : cat.title.uz
                  return (
                    <motion.div
                      key={cat.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx, duration: 0.3 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${cat.color}20`, border: `1px solid ${cat.color}40` }}
                        >
                          <Icon size={16} style={{ color: cat.color }} />
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                          {title}
                        </h3>
                      </div>
                      <ul className="space-y-2 pl-10">
                        {items.map(item => (
                          <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <CheckCircle
                              size={15}
                              className="shrink-0 mt-0.5"
                              style={{ color: '#22c55e' }}
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )
                })}
              </div>

              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary w-full text-base"
              >
                <Crown size={18} />
                {t('premiumPage.upgradeNowBtn')}
              </button>

              <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                {t('premiumPage.activatedNote')}
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
        amount={50000}
        initialName={initialName}
        initialPhone={initialPhone}
      />
    </div>
  )
}
