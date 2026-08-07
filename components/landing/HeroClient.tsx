'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import SplitText from '@/components/text/SplitText'
import RotatingText from '@/components/text/RotatingText'
import SpecularButton from '@/components/buttons/SpecularButton'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// Landing hero. Silk fon global mount qilingan. Bu yerda flex-center
// bilan barcha element'lar bir vertikal ustunda space-y-8 orqali
// bir tekis oraliqda joylashadi -- katta bo'sh joy yo'q. Scroll
// indicator hero pastida absolute pozitsiyada.

interface HeroClientProps {
  ctaHref: string
  hasUser: boolean
}

export function HeroClient({ ctaHref, hasUser }: HeroClientProps) {
  const router = useRouter()
  const reduce = useReducedMotion()
  const { t } = useLanguage()

  const rotatingTexts = [
    t('landing.hero.rotating1'),
    t('landing.hero.rotating2'),
    t('landing.hero.rotating3'),
    t('landing.hero.rotating4'),
  ]

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6 space-y-8 py-24">
        {/* 1. Sarlavha -- SplitText remount qilinishi uchun til bo'yicha key */}
        <SplitText
          key={t('landing.hero.titleBefore')}
          tag="h1"
          text={t('landing.hero.titleBefore')}
          className="text-5xl md:text-7xl font-black leading-tight text-white"
          delay={40}
          duration={0.8}
          ease="power3.out"
          splitType="chars"
          from={{ opacity: 0, y: 60, rotationX: -90 }}
          to={{ opacity: 1, y: 0, rotationX: 0 }}
          threshold={0.1}
        />

        {/* 2. Rotating pill -- to'q gradient fon (Silk halo yo'q).
            Chip fon opacity 100 bilan matn kontrasti aniq. */}
        <div className="flex items-center justify-center">
          <RotatingText
            texts={rotatingTexts}
            mainClassName="px-5 py-2 rounded-xl text-white text-4xl md:text-5xl font-bold"
            mainStyle={{
              // To'q gradient -- Silk halo yo'q, matn kontrasti aniq
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
            }}
            splitLevelClassName="overflow-hidden"
            staggerFrom="last"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-120%' }}
            staggerDuration={0.025}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            rotationInterval={2500}
          />
        </div>

        {/* 3. Subheading */}
        <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          {t('landing.hero.subtitle')}
        </p>

        {/* 4. CTA */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-center">
          <SpecularButton
            size="lg"
            radius={16}
            tint="#6366f1"
            tintOpacity={0.15}
            textColor="#ffffff"
            lineColor="#a5b4fc"
            baseColor="#4f46e5"
            intensity={1.2}
            shineSize={12}
            shineFade={40}
            thickness={1.5}
            speed={0.4}
            followMouse
            proximity={300}
            autoAnimate={false}
            onClick={() => router.push(ctaHref)}
          >
            {t('landing.hero.ctaPrimary')}
          </SpecularButton>
          {!hasUser && (
            <Link href="/login" className="btn-outline text-base px-8 py-3">
              {t('landing.hero.ctaSecondary')}
            </Link>
          )}
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('landing.hero.note')}
        </p>
      </div>

      {/* Scroll indicator -- hero pastida absolute markazda */}
      <motion.a
        href="#features"
        aria-label={t('landing.hero.scrollHint')}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-muted)' }}
        animate={reduce ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-xs">{t('landing.hero.scrollHint')}</span>
        <ChevronDown size={18} />
      </motion.a>
    </section>
  )
}
