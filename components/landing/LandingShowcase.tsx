'use client'

/* "Mahsulot isboti" (product proof) galereyasi -- kirish sahifasida
   Hero'dan keyin, Features'dan oldin. Admin panelning "Sayt rasmlari"
   bo'limidan yuklangan haqiqiy skrinshotlarni CardSwap (gsap 3D
   karta-stack) animatsiyasi orqali ko'rsatadi -- kartalar bir-birining
   orqasiga qatlamlanib turadi va har 4.2 soniyada avtomatik almashadi
   (eng oldingi karta pastga tushib, orqaga o'tadi, qolganlari oldinga
   siljiydi). Sichqoncha ustiga qo'yilganda animatsiya pauza qilinadi.

   Chap tomondagi matn ham joriy (eng oldingi) rasmga mos ravishda
   sinxron o'zgarib turadi -- CardSwap'ning onActiveChange callback'i
   orqali qaysi rasm hozir faolligini bilib olamiz va uning admin
   tomonidan yozilgan sarlavhasini (title) shu yerda silliq (fade)
   almashtiramiz. Har bir kartaning ichida ham xuddi shu matn pastida
   (mini-browser skrinshoti ostida) ko'rinadi.

   Rasm yuklanmagan bo'lsa (admin hali hech narsa qo'shmagan bo'lsa)
   umuman render qilinmaydi -- bo'sh bo'lim ko'rsatilmaydi. Kamaytirilgan
   harakat (prefers-reduced-motion) yoqilgan bo'lsa, CardSwap o'zi ichida
   avtomatik almashishni to'xtatadi (qarang: CardSwap.tsx) -- shu holatda
   chap tomondagi matn ham birinchi rasmda statik qoladi. */

import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionReveal } from '@/components/landing/SectionReveal'
import CardSwap, { Card } from '@/components/landing/CardSwap'

export interface ShowcaseImage {
  id: string
  title: string | null
  image_url: string
}

const CHROME_HEIGHT = 36
// CardSwap'ga beriladigan "delay" -- bitta rasm shu qadar millisekund
// (4200ms = 4.2 soniya) ko'rsatilgach, keyingisiga almashadi.
const SWAP_DELAY_MS = 4200

export function LandingShowcase({ images }: { images: ShowcaseImage[] }) {
  const { t } = useLanguage()
  const [activeIndex, setActiveIndex] = useState(0)

  // CardSwap effekt ichida chaqiradi -- useState setter allaqachon
  // barqaror (stable) bo'lgani uchun useCallback shart emas, lekin
  // aniqlik uchun eksplitsit qoldiramiz.
  const handleActiveChange = useCallback((idx: number) => setActiveIndex(idx), [])

  if (images.length === 0) return null

  const active = images[activeIndex] ?? images[0]

  return (
    <SectionReveal id="showcase" className="max-w-6xl mx-auto px-6 py-20 relative">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="text-center lg:text-left">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('landing.showcase.title')}
          </h2>
          <p className="max-w-md mx-auto lg:mx-0" style={{ color: 'var(--text-muted)' }}>
            {t('landing.showcase.subtitle')}
          </p>

          {/* Joriy (eng oldingi) rasmga mos sarlavha -- rasm almashganda
              silliq fade bilan yangilanadi. Admin shu rasmga sarlavha
              yozmagan bo'lsa, umuman ko'rsatilmaydi. */}
          <div className="mt-6 min-h-[44px] flex justify-center lg:justify-start">
            <AnimatePresence mode="wait">
              {active?.title && (
                <motion.span
                  key={active.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                  {active.title}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="relative h-[320px] sm:h-[380px] lg:h-[460px]">
          <CardSwap
            width={360}
            height={240}
            cardDistance={46}
            verticalDistance={50}
            delay={SWAP_DELAY_MS}
            pauseOnHover
            skewAmount={4}
            onActiveChange={handleActiveChange}
          >
            {images.map((img) => (
              <Card key={img.id}>
                <div
                  className="flex items-center gap-1.5 px-3"
                  style={{
                    height: CHROME_HEIGHT,
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e' }} />
                </div>
                <div style={{ position: 'relative', width: '100%', height: `calc(100% - ${CHROME_HEIGHT}px)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- rasm soni dinamik, next/image domain whitelist qo'shishni talab qiladi */}
                  <img
                    src={img.image_url}
                    alt={img.title ?? 'IELTS.PRO'}
                    loading="lazy"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'top',
                    }}
                  />
                  {img.title && (
                    <div
                      className="absolute bottom-0 left-0 right-0 text-xs font-semibold text-center py-2 px-2"
                      style={{
                        background: 'color-mix(in srgb, var(--bg-card) 82%, transparent)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {img.title}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </CardSwap>
        </div>
      </div>
    </SectionReveal>
  )
}
