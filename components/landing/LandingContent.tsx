'use client'

/* Client-side landing content (nav links / footer / features / band table /
   pricing) — extracted from app/page.tsx so it can react to useLanguage()
   without turning the whole page into a client component. The server page
   still handles the auth check and passes ctaHref/hasUser down. */

import Link from 'next/link'
import { ArrowRight, Crown, CheckCircle, Video } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionReveal } from '@/components/landing/SectionReveal'
import { FeaturesGrid } from '@/components/landing/FeaturesGrid'
import SplitText from '@/components/text/SplitText'
import ElectricBorder from '@/components/effects/ElectricBorder'
import SpecularButton from '@/components/buttons/SpecularButton'

const BAND_ROWS = [
  { raw: '39–40',    band: '9.0', color: '#10b981', level: 'Expert' },
  { raw: '37–38',    band: '8.5', color: '#22c55e', level: 'Expert' },
  { raw: '35–36',    band: '8.0', color: '#3b82f6', level: 'Very Good' },
  { raw: '33–34',    band: '7.5', color: '#6366f1', level: 'Good' },
  { raw: '30–32',    band: '7.0', color: '#6366f1', level: 'Good' },
  { raw: '23–26',    band: '6.0', color: '#f59e0b', level: 'Competent' },
  { raw: '15–18',    band: '5.0', color: '#f97316', level: 'Modest' },
  { raw: 'Below 10', band: '3.5', color: '#ef4444', level: 'Limited' },
]

/* Helper: pull an array-shaped translation directly out of messages so we
   avoid teaching t() a whole array-return codepath. Falls back to []. */
import en from '@/messages/en.json'
import uz from '@/messages/uz.json'
function tArray(lang: 'en' | 'uz', path: string): string[] {
  const parts = path.split('.')
  let cur: unknown = lang === 'en' ? en : uz
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return []
    cur = (cur as Record<string, unknown>)[p]
  }
  return Array.isArray(cur) ? (cur as string[]) : []
}

export function LandingNavLinks() {
  const { t } = useLanguage()
  const items = [
    { href: '#features',   label: t('landing.nav.features') },
    { href: '#band-table', label: t('landing.nav.bandTable') },
    { href: '#pricing',    label: t('landing.nav.pricing') },
  ]
  return (
    <>
      {items.map(item => (
        <a
          key={item.href}
          href={item.href}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          {item.label}
        </a>
      ))}
    </>
  )
}

/* Kirish sahifasi navbar'i uchun ixcham til almashtirgich (UZ/EN).
   Dashboard sidebar'idagi bayroqli variantdan farqli o'laroq, bu yerda
   joy tor (navbar bitta qatorda) -- shuning uchun oddiy matnli
   segmented-control ko'rinishida, faol til aksent rangda ajratiladi. */
export function LandingLanguageToggle() {
  const { lang, setLang } = useLanguage()
  return (
    <div
      className="flex items-center rounded-full p-0.5"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      role="group"
      aria-label="Til / Language"
    >
      {(['uz', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className="px-2.5 py-1 text-xs font-bold rounded-full transition-all"
          style={{
            background: lang === code ? 'var(--accent)' : 'transparent',
            color: lang === code ? '#fff' : 'var(--text-muted)',
          }}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function LandingAuthCta({ hasUser }: { hasUser: boolean }) {
  const { t } = useLanguage()
  if (hasUser) {
    return (
      <Link href="/dashboard" className="btn-primary text-sm">
        {t('landing.nav.dashboard')} <ArrowRight size={14} />
      </Link>
    )
  }
  return (
    <>
      <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-all hidden sm:inline-block" style={{ color: 'var(--text-secondary)' }}>
        {t('landing.nav.signIn')}
      </Link>
      <Link href="/signup" className="btn-primary text-sm">
        {t('landing.nav.getStarted')} <ArrowRight size={14} />
      </Link>
    </>
  )
}

export function LandingFeaturesSection() {
  const { t } = useLanguage()
  return (
    <SectionReveal id="features" className="max-w-6xl mx-auto px-6 py-20 relative">
      <SplitText
        tag="h2"
        text={t('landing.featuresSection.title')}
        className="text-3xl md:text-4xl font-bold text-center mb-4"
        delay={30}
        splitType="words"
        from={{ opacity: 0, y: 30 }}
        to={{ opacity: 1, y: 0 }}
      />
      <p className="text-center mb-12 max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
        {t('landing.featuresSection.subtitle')}
      </p>
      <FeaturesGrid />

      <p className="text-center text-sm mt-10" style={{ color: 'var(--text-muted)' }}>
        <Video size={13} className="inline mr-1.5 -mt-0.5" />
        {t('landing.featuresSection.alsoIncluded')}
      </p>
      <p className="text-center text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('landing.featuresSection.comingSoonLabel')}</span>{' '}
        {t('landing.featuresSection.comingSoonList')}
      </p>
    </SectionReveal>
  )
}

export function LandingBandTableSection() {
  const { t } = useLanguage()
  return (
    <SectionReveal id="band-table" className="max-w-3xl mx-auto px-6 py-20 relative">
      <SplitText
        tag="h2"
        text={t('landing.bandSection.title')}
        className="text-3xl md:text-4xl font-bold text-center mb-4"
        delay={30}
        splitType="words"
        from={{ opacity: 0, y: 30 }}
        to={{ opacity: 1, y: 0 }}
      />
      <p className="text-center mb-10" style={{ color: 'var(--text-muted)' }}>{t('landing.bandSection.subtitle')}</p>
      <div className="card overflow-hidden" style={{ borderRadius: 16 }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <th className="py-3 px-4 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{t('landing.bandSection.rawScore')}</th>
              <th className="py-3 px-4 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{t('landing.bandSection.band')}</th>
              <th className="py-3 px-4 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>{t('landing.bandSection.level')}</th>
            </tr>
          </thead>
          <tbody>
            {BAND_ROWS.map(row => (
              <tr
                key={row.band}
                className="transition-colors hover:bg-white/5"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{row.raw}</td>
                <td className="py-3 px-4 font-black text-lg">
                  <span
                    className="bg-clip-text text-transparent animate-hero-gradient"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${row.color}, #fff, ${row.color})`,
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {row.band}
                  </span>
                </td>
                <td className="py-3 px-4" style={{ color: 'var(--text-muted)' }}>{row.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionReveal>
  )
}

export function LandingPricingSection({ ctaHref }: { ctaHref: string }) {
  const { t, lang } = useLanguage()
  const freeFeatures = tArray(lang, 'landing.pricingFull.freeFeatures')
  const premiumFeatures = tArray(lang, 'landing.pricingFull.premiumFeatures')

  return (
    <SectionReveal id="pricing" className="max-w-5xl mx-auto px-6 py-20 relative">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">{t('landing.pricingFull.title')}</h2>
      <p className="text-center mb-14" style={{ color: 'var(--text-muted)' }}>
        {t('landing.pricingFull.subtitle')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch max-w-4xl mx-auto">
        {/* ── Free ── */}
        <div className="card p-8 flex flex-col" style={{ borderRadius: 20 }}>
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-1">{t('landing.pricingFull.freeName')}</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('landing.pricingFull.freeSubtitle')}</p>
          </div>
          <div className="mb-6">
            <div className="text-5xl font-black">0 UZS</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{t('landing.pricingFull.freePriceNote')}</div>
          </div>
          <Link href={ctaHref} className="btn-secondary w-full mb-8 text-sm flex justify-center">
            {t('landing.pricingFull.freeCta')}
          </Link>
          <div className="flex-1 space-y-3">
            {freeFeatures.map(f => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Premium ── */}
        <ElectricBorder
          color="#6366f1"
          speed={1}
          chaos={0.15}
          thickness={2}
          style={{ borderRadius: 20 }}
        >
          <div
            className="card p-8 flex flex-col relative"
            style={{
              border: '1px solid rgba(99,102,241,0.30)',
              borderRadius: 20,
              background: 'linear-gradient(160deg, rgba(99,102,241,0.08), var(--bg-card) 60%)',
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap animate-hero-gradient"
              style={{
                backgroundImage: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899, #8b5cf6, #6366f1)',
                backgroundSize: '200% auto',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
              }}
            >
              {t('landing.pricingFull.recommended')}
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Crown size={22} style={{ color: '#f59e0b' }} />
                {t('landing.pricingFull.premiumName')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('landing.pricingFull.premiumSubtitle')}</p>
            </div>
            <div className="mb-6">
              <div className="text-5xl font-black" style={{ color: 'var(--accent)' }}>50,000 UZS</div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('landing.pricingFull.premiumPriceMonthly')}
              </div>
            </div>
            <div className="mb-8">
              <SpecularButton
                size="lg"
                radius={12}
                tint="#6366f1"
                tintOpacity={0.2}
                textColor="#ffffff"
                lineColor="#c7d2fe"
                baseColor="#4338ca"
                intensity={1.3}
                shineSize={14}
                shineFade={35}
                thickness={2}
                speed={0.45}
                followMouse
                proximity={250}
                autoAnimate
                href={ctaHref}
                className="w-full"
                style={{ width: '100%' }}
              >
                <Crown size={14} /> {t('landing.pricingFull.premiumCta')}
              </SpecularButton>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                {t('landing.pricingFull.premiumIncludes')}
              </p>
              <div className="space-y-3">
                {premiumFeatures.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ElectricBorder>
      </div>

      <p className="text-center text-sm mt-8" style={{ color: 'var(--text-muted)' }}>
        {t('landing.pricingFull.activatedInHours')}
      </p>
    </SectionReveal>
  )
}

export function LandingFooter({ ctaHref }: { ctaHref: string }) {
  const { t } = useLanguage()
  return (
    <footer className="relative border-t text-center py-8 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
      <div className="flex items-center justify-center gap-4 mb-3 flex-wrap">
        <Link href={ctaHref} className="hover:opacity-80 transition-opacity" style={{ color: 'var(--text-secondary)' }}>{t('landing.footer.dashboard')}</Link>
        <span aria-hidden>·</span>
        <Link href="/feedback" className="hover:opacity-80 transition-opacity" style={{ color: 'var(--text-secondary)' }}>{t('landing.footer.feedback')}</Link>
        <span aria-hidden>·</span>
        <span>{t('landing.footer.communityComingSoon')}</span>
      </div>
      <div>© {new Date().getFullYear()} IELTS CDI. {t('landing.footer.rights')}.</div>
    </footer>
  )
}
