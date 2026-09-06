'use client'

/* Kirish sahifasidagi sichqoncha g'ildiragi bilan scroll qilishni
   "inersiyali" (silliq, yumshoq to'xtaydigan) qilish -- `lenis`
   kutubxonasi orqali. Bu faqat KIRISH SAHIFASIGA ulanadi (dashboard,
   testlar kabi ichki sahifalarga emas) -- chunki u yerda jadval/scroll
   konteynerlar ko'p, va scroll'ni "o'g'irlash" keraksiz xavf tug'diradi.

   MUHIM: bu ishlashi uchun loyihaga `lenis` paketi o'rnatilgan bo'lishi
   kerak -- terminalda: npm install lenis

   `prefers-reduced-motion` yoqilgan foydalanuvchilarda umuman
   ishga tushmaydi -- brauzerning oddiy (darhol) scrolli ishlatiladi. */

import { useEffect } from 'react'
import Lenis from 'lenis'

export function SmoothScroll() {
  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
    })

    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [])

  return null
}
