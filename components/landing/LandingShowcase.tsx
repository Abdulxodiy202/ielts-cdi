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

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionReveal } from '@/components/landing/SectionReveal'
import CardSwap, { Card } from '@/components/landing/CardSwap'

export interface ShowcaseImage {
  id: string
  title: string | null
  title_en: string | null
  image_url: string
}

// Joriy tilga mos sarlavhani tanlaydi -- admin faqat bitta tilga
// sarlavha yozgan bo'lsa ham (masalan title_en bo'sh qoldirilgan),
// bo'lim "sarlavha yo'q" bo'lib bo'sh ko'rinib qolmasligi uchun
// mavjud bo'lgan tilga qaytadi (fallback).
function pickTitle(img: ShowcaseImage | undefined, lang: 'en' | 'uz'): string | null {
  if (!img) return null
  const preferred = lang === 'en' ? img.title_en : img.title
  return preferred || img.title || img.title_en || null
}

const CHROME_HEIGHT = 36
// CardSwap'ga beriladigan "delay" -- bitta rasm shu qadar millisekund
// (4200ms = 4.2 soniya) ko'rsatilgach, keyingisiga almashadi.
const SWAP_DELAY_MS = 4200

export function LandingShowcase({ images }: { images: ShowcaseImage[] }) {
  const { t, lang } = useLanguage()
  const [activeIndex, setActiveIndex] = useState(0)

  // CardSwap effekt ichida chaqiradi -- useState setter allaqachon
  // barqaror (stable) bo'lgani uchun useCallback shart emas, lekin
  // aniqlik uchun eksplitsit qoldiramiz.
  const handleActiveChange = useCallback((idx: number) => setActiveIndex(idx), [])

  // 2026-09: kartani bosganda rasm to'liq ekranga "kattalashadi" (lightbox) --
  // Telegram/rasm ko'ruvchilarga o'xshab, chapga/o'ngga strelkalar bilan
  // boshqa rasmlarga o'tish mumkin. `lightboxIndex` -- images massividagi
  // asl indeks (CardSwap animatsiyasi tartibiga bog'liq emas).
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const showPrev = useCallback(
    () => setLightboxIndex(i => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length]
  )
  const showNext = useCallback(
    () => setLightboxIndex(i => (i === null ? null : (i + 1) % images.length)),
    [images.length]
  )

  // Lightbox ochiq bo'lganda: Esc -- yopish, ←/→ -- rasm almashtirish,
  // va orqa fondagi sahifa scroll bo'lib ketmasligi uchun body scroll
  // vaqtincha o'chiriladi.
  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowLeft') showPrev()
      else if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxIndex, closeLightbox, showPrev, showNext])

  if (images.length === 0) return null

  const active = images[activeIndex] ?? images[0]
  const activeTitle = pickTitle(active, lang)
  const lightboxImg = lightboxIndex !== null ? images[lightboxIndex] : null

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
              yozmagan bo'lsa, umuman ko'rsatilmaydi.

              2026-09 dizayn: avvalgi kichik "chat pufakcha" pill o'rniga --
              endi kichik nuqta+harakatlanuvchi chiziqcha "hozir ko'rsatilmoqda"
              yorlig'i (kicker) + uning ostida katta, qalin sarlavha matni.
              Bu matn faqat shu yerda (chap tomonda) ko'rinadi -- rasm
              ustidagi eski dublikat overlay olib tashlandi (pastga qarang). */}
          <div className="mt-8 min-h-[70px] flex flex-col items-center lg:items-start">
            <AnimatePresence mode="wait">
              {activeTitle && (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                >
                  <div className="flex items-center gap-2 justify-center lg:justify-start mb-1.5">
                    <span
                      className="relative flex items-center justify-center"
                      style={{ width: 8, height: 8 }}
                    >
                      <span
                        className="absolute inline-flex h-full w-full rounded-full animate-ping"
                        style={{ background: '#60a5fa', opacity: 0.6 }}
                      />
                      <span
                        className="relative inline-flex rounded-full"
                        style={{ width: 8, height: 8, background: '#60a5fa' }}
                      />
                    </span>
                    <span
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: 'var(--accent)' }}
                    >
                      {t('landing.showcase.nowShowing')}
                    </span>
                  </div>
                  <h3
                    className="text-xl md:text-2xl font-bold leading-snug pl-4"
                    style={{ borderLeft: '3px solid var(--accent)', color: 'var(--text-primary)' }}
                  >
                    {activeTitle}
                  </h3>
                </motion.div>
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
            onCardClick={(idx) => setLightboxIndex(idx)}
          >
            {images.map((img) => (
              <Card key={img.id} customClass="group" style={{ cursor: 'pointer' }}>
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
                    alt={pickTitle(img, lang) ?? 'IELTS.PRO'}
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
                  {/* 2026-09: rasm ustidagi sarlavha overlay olib tashlandi --
                      matn endi FAQAT chap tomondagi katta sarlavhada (yuqorida)
                      ko'rinadi, rasmning o'zi esa toza (faqat skrinshot)
                      ko'rinishda qoladi.

                      2026-09: bosilsa kattalashishini bildirish uchun hover'da
                      chiqadigan kichik "kattalashtirish" belgisi -- karta
                      bosilganda pastdagi lightbox ochiladi. */}
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ background: 'rgba(0,0,0,0.28)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.92)', color: '#111' }}
                    >
                      <Maximize2 size={16} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </CardSwap>
        </div>
      </div>

      {/* Lightbox -- karta bosilganda rasm to'liq ekranga kattalashadi.
          document.body'ga portal orqali chiqariladi -- SectionReveal
          o'zining scroll-animatsiyasi uchun `transform` qo'yadi, bu esa
          `position: fixed` uchun yangi containing block yaratib, lightbox'ni
          butun ekran o'rniga shu bo'lim ichiga qamab qo'yishi mumkin edi.
          Portal shu muammoni butunlay chetlab o'tadi. */}
      {mounted && createPortal(
        <AnimatePresence>
          {lightboxImg && (
            <motion.div
              key="showcase-lightbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center px-4 py-10 sm:px-10"
              style={{ background: 'rgba(10,10,20,0.88)', backdropFilter: 'blur(4px)', zIndex: 200 }}
              onClick={closeLightbox}
            >
              <button
                type="button"
                onClick={closeLightbox}
                aria-label="Yopish"
                className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              >
                <X size={20} />
              </button>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); showPrev() }}
                    aria-label="Oldingi rasm"
                    className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); showNext() }}
                    aria-label="Keyingi rasm"
                    className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}

              <motion.div
                key={lightboxImg.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="max-w-4xl w-full flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- lightbox'da domain whitelist shart emas */}
                <img
                  src={lightboxImg.image_url}
                  alt={pickTitle(lightboxImg, lang) ?? 'IELTS.PRO'}
                  className="max-h-[75vh] w-auto rounded-xl"
                  style={{ boxShadow: '0 24px 70px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                {pickTitle(lightboxImg, lang) && (
                  <p className="mt-4 text-sm sm:text-base font-medium text-center px-4" style={{ color: '#f1f5f9' }}>
                    {pickTitle(lightboxImg, lang)}
                  </p>
                )}
                {images.length > 1 && (
                  <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {(lightboxIndex as number) + 1} / {images.length}
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </SectionReveal>
  )
}
