'use client'

import Link from 'next/link'
import { Crown, CheckCircle, XCircle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function PricingSection({ ctaHref }: { ctaHref: string }) {
  const { t } = useLanguage()

  const freeFeatures = [
    t('pricing.freeFeature1'),
    t('pricing.freeFeature2'),
    t('pricing.freeFeature3'),
    t('pricing.freeFeature4'),
    t('pricing.freeFeature5'),
    t('pricing.freeFeature6'),
  ]

  const lockedFeatures = [
    t('pricing.freeLocked1'),
    t('pricing.freeLocked2'),
  ]

  const premiumFeatures = [
    t('pricing.premiumFeature1'),
    t('pricing.premiumFeature2'),
    t('pricing.premiumFeature3'),
    t('pricing.premiumFeature4'),
  ]

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-bold text-center mb-12">{t('pricing.title')}</h2>
      <div className="grid sm:grid-cols-2 gap-6 items-stretch">

        {/* Free card */}
        <div className="card p-8 flex flex-col">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{t('pricing.freePlanName')}</h3>
            <div className="text-4xl font-black mb-1">0 UZS</div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{t('pricing.freePlanSub')}</p>

            {freeFeatures.map(f => (
              <div key={f} className="flex items-center gap-2 mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <CheckCircle size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
                {f}
              </div>
            ))}

            {lockedFeatures.map(f => (
              <div key={f} className="flex items-center gap-2 mb-2 text-sm" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                <XCircle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <Link href={ctaHref} className="btn-secondary w-full mt-6 text-sm flex justify-center">
            {t('pricing.ctaFree')}
          </Link>
        </div>

        {/* Premium card */}
        <div className="card p-8 flex flex-col relative" style={{ border: '2px solid var(--accent)' }}>
          {/* Badge — borderTopRightRadius matches card corner (12px radius - 2px border = 10px) */}
          <div
            className="absolute top-0 right-0 px-3 py-1 text-xs font-bold"
            style={{
              background: 'var(--accent)',
              color: 'white',
              borderTopRightRadius: 10,
              borderBottomLeftRadius: 8,
            }}
          >
            {t('pricing.popularBadge')}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Crown size={20} style={{ color: '#f59e0b' }} />
              <h3 className="text-xl font-bold">Premium</h3>
            </div>
            <div className="text-4xl font-black mb-1" style={{ color: 'var(--accent)' }}>50,000 UZS</div>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{t('pricing.premiumPlanSub')}</p>

            {premiumFeatures.map(f => (
              <div key={f} className="flex items-center gap-2 mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <CheckCircle size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {f}
              </div>
            ))}
          </div>

          <Link href={ctaHref} className="btn-primary w-full mt-6 text-sm flex justify-center gap-2">
            <Crown size={14} /> {t('pricing.ctaPremium')}
          </Link>
        </div>

      </div>
    </section>
  )
}
