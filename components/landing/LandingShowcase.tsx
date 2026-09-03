'use client'

/* "Mahsulot isboti" (product proof) galereyasi -- kirish sahifasida
   Hero'dan keyin, Features'dan oldin. Admin panelning "Sayt rasmlari"
   bo'limidan yuklangan haqiqiy skrinshotlarni har biri mini browser
   oynasi ko'rinishida (macOS uslubidagi uch nuqta) ko'rsatadi --
   scroll'ga kirganda tartib bilan (stagger) paydo bo'ladi, biroz
   qiyshaygan holatda turadi, hover qilinganda tekislanib ko'tariladi.
   Rasm yuklanmagan bo'lsa (admin hali hech narsa qo'shmagan bo'lsa)
   umuman render qilinmaydi -- bo'sh bo'lim ko'rsatilmaydi. */

import { motion, useReducedMotion } from 'framer-motion'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionReveal } from '@/components/landing/SectionReveal'

export interface ShowcaseImage {
  id: string
  title: string | null
  image_url: string
}

export function LandingShowcase({ images }: { images: ShowcaseImage[] }) {
  const { t } = useLanguage()
  const reduce = useReducedMotion()

  if (images.length === 0) return null

  return (
    <SectionReveal id="showcase" className="max-w-6xl mx-auto px-6 py-20 relative">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
        {t('landing.showcase.title')}
      </h2>
      <p className="text-center mb-14 max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
        {t('landing.showcase.subtitle')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {images.map((img, i) => {
          const tilt = reduce ? 0 : (i % 2 === 0 ? -2 : 2)
          return (
            <motion.div
              key={img.id}
              initial={reduce ? undefined : { opacity: 0, y: 50, rotate: tilt * 2 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0, rotate: tilt }}
              whileHover={reduce ? undefined : { rotate: 0, y: -8, scale: 1.03 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: 'easeOut' }}
              style={{ transformOrigin: 'center bottom' }}
              className="group"
            >
              <div
                className="rounded-2xl overflow-hidden transition-shadow"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                }}
              >
                {/* Mini browser chrome -- rasm haqiqiy sayt skrinshoti
                    ekanini bir qarashda "browser oynasi ichida" degan
                    taassurot orqali ta'kidlaydi. */}
                <div
                  className="flex items-center gap-1.5 px-3 py-2.5"
                  style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b' }} />
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e' }} />
                </div>
                <div style={{ position: 'relative', width: '100%', paddingTop: '62%' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- rasm soni dinamik, next/image domain whitelist qo'shishni talab qiladi */}
                  <img
                    src={img.image_url}
                    alt={img.title ?? 'IELTS.PRO'}
                    loading="lazy"
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', objectPosition: 'top',
                      transition: 'transform 0.5s ease',
                    }}
                    className="group-hover:scale-[1.04]"
                  />
                </div>
                {img.title && (
                  <p
                    className="text-sm font-semibold text-center py-3 px-3"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {img.title}
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </SectionReveal>
  )
}
