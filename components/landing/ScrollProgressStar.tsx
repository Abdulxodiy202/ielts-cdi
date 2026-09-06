'use client'

/* Kirish sahifasi uchun scroll-progress "yulduz" -- crackd.it saytida
   ko'rgan effekt: sahifani pastga scroll qilgan sayin, ekran chetidagi
   ingichka chiziq bo'ylab yorqin (porlaydigan) nuqta pastga tushadi va
   o'zi bosib o'tgan qismda yorqin (solid) chiziq qoldiradi, hali
   yetib bormagan qismi esa xira (dashed/punktir) bo'lib ko'rinadi.

   Bu effekt BUTUN sahifa scrolliga bog'langan (har qanday bo'lim
   tarkibiga bog'liq emas -- Features grid, Pricing va h.k. qanday
   o'zgarmasin, bu doim ishlayveradi). Ekranning chap chetida, vertikal
   markazga yaqin joyda `position: fixed` holda turadi -- sahifa bilan
   birga scroll bo'lmaydi, ekranga "yopishib" qoladi, faqat ichidagi
   yulduzning pozitsiyasi sahifa scroll foizi (scrollYProgress) bo'yicha
   o'zgaradi. Tor ekranlarda (mobil/planshet) joy yetishmagani uchun
   yashiriladi (`hidden lg:block`). */

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

export function ScrollProgressStar() {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const starTop = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  // Kamaytirilgan harakat yoqilgan bo'lsa -- butunlay ko'rsatilmaydi,
  // chunki bu sof dekorativ, harakatga asoslangan element.
  if (reduce) return null

  return (
    <div
      aria-hidden
      className="hidden lg:block fixed z-40 pointer-events-none"
      style={{ left: 28, top: '18vh', bottom: '18vh', width: 2 }}
    >
      <div className="relative w-full h-full">
        {/* Punktir "yo'l" -- hali bosib o'tilmagan qism, doim to'liq
            balandlikda, orqa fonda turadi. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 5px, transparent 5px, transparent 12px)',
          }}
        />

        {/* Yorqin (solid) "iz" -- yulduz bosib o'tgan qism. `scaleY` +
            `transformOrigin: top` orqali yuqoridan pastga qarab "o'sadi" --
            bu layout qayta hisoblashni talab qilmaydigan, silliq usul. */}
        <motion.div
          className="absolute top-0 left-0 w-full h-full rounded-full"
          style={{
            scaleY: scrollYProgress,
            transformOrigin: 'top',
            background: 'linear-gradient(to bottom, #60a5fa, var(--accent))',
            boxShadow: '0 0 8px rgba(96,165,250,0.5)',
          }}
        />

        {/* Yorqin, porlaydigan "yulduz" -- joriy scroll pozitsiyasini
            ko'rsatadi. */}
        <motion.div
          className="absolute left-1/2"
          style={{ top: starTop, translateX: '-50%', translateY: '-50%' }}
        >
          <span
            className="block rounded-full"
            style={{
              width: 10,
              height: 10,
              background: '#93c5fd',
              boxShadow: '0 0 6px 2px #60a5fa, 0 0 16px 6px rgba(96,165,250,0.55)',
            }}
          />
        </motion.div>
      </div>
    </div>
  )
}
