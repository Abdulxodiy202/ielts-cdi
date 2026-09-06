'use client'

/* Kirish sahifasi uchun "ilon izi" (snake trail) scroll-effekti --
   crackd.it saytida ko'rgan effektga o'xshab: sahifa markazida, chapga-
   o'ngga tebranib pastga tushuvchi to'lqinsimon chiziq, uning ustida esa
   yorqin porlaydigan "kometa boshi" (yulduz) ko'rinadi. Chiziqning
   "bosib o'tilgan" qismi yorqin (gradient) bo'lib qoladi, hali yetib
   bormagan qismi esa punktir bo'lib turadi.

   2-versiyadagi XATO (tuzatildi): yulduzning VERTIKAL pozitsiyasi avval
   `top: progress*100%` deb, scroll progress'dan har freym'da JS orqali
   hisoblanardi. Bu matematik jihatdan quyidagi muammoni keltirib
   chiqargan edi: agar o'ragilgan bo'lim balandligi ekran balandligidan
   N marta katta bo'lsa (masalan 5 marta), yulduz ekran ichida atigi
   1/N tezlikda harakatlanadi -- ya'ni atrofdagi kontent tabiiy tezlikda
   yuqoriga siljisa, yulduz "sudralib qolganday" sekin harakatlanadi.
   Foydalanuvchi buni "animatsiya g'alati" deb ta'riflagani aynan shu edi.

   YECHIM: yulduzning VERTIKAL joylashuvi endi CSS `position: sticky` +
   `top: 50vh` orqali -- bu brauzerning o'zi hal qiladigan, hech qanday
   JS hisob-kitobsiz, 100% silliq usul. Natijada yulduz butun shu
   o'ragich bo'ylab scroll qilinganda ekранning DOIM vertikal markazida
   "yopishib" turadi (xuddi sahifadagi boshqa `position: sticky`
   elementlar -- masalan navbar -- kabi), so'ng o'ragich tugagach oddiy
   kontent bilan birga yuqoriga chiqib ketadi. Faqat GORIZONTAL (chapga-
   o'ngga to'lqin) pozitsiya endi ham scroll progress'ga bog'liq --
   shu orqali "ilon izi" harakati saqlanib qoladi, lekin endi u faqat
   yengil, silliq chapga-o'ngga siljish, vertikal "sudralish" yo'q.

   Fon chizig'i (SVG path) o'zgarishsiz qoldi -- u shunchaki bezak,
   butun o'ragich bo'ylab statik chizilgan, faqat uning "porlash"
   (gradient reveal) qismi scroll progress bilan silliq ochiladi.

   Bo'lim HALI boshlanmagan bo'lsa (foydalanuvchi hali Hero'da, pastga
   scroll qilmagan) progress = 0 va `opacity` ham 0 -- shuning uchun
   boshida chiziq/yulduz umuman ko'rinmaydi, faqat scroll qila
   boshlagach paydo bo'ladi. */

import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

// Chiziq markazdan chapga/o'ngga necha % (o'ragichning o'z kengligiga
// nisbatan) tebranadi -- kattaroq qiymat = kengroq "ilon izi".
const AMPLITUDE_PCT = 22
// Butun balandlik bo'ylab nechta to'liq to'lqin tsikli bo'lishi -- kichik
// bo'lim uchun ozroq, uzun bo'lim uchun ko'proq tsikl tabiiy ko'rinadi.
const WAVE_COUNT = 4
// Path silliqligi uchun namuna nuqtalar soni.
const STEPS = 80

function waveX(t: number): number {
  return 50 + AMPLITUDE_PCT * Math.sin(t * WAVE_COUNT * Math.PI * 2)
}

function buildWavePath(): string {
  const parts: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS
    const x = waveX(t)
    const y = t * 100
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return parts.join(' ')
}

const PATH_D = buildWavePath()

export function ScrollSnakeTrail({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  const opacity = useTransform(scrollYProgress, [0, 0.04], [0, 1])
  const starLeft = useTransform(scrollYProgress, (v) => `${waveX(v)}%`)
  const dashOffset = useTransform(scrollYProgress, (v) => 1 - v)

  return (
    <div ref={containerRef} className="relative">
      {!reduce && (
        <div
          aria-hidden
          className="hidden lg:block absolute inset-y-0 pointer-events-none"
          style={{ left: '50%', transform: 'translateX(-50%)', width: 'min(90%, 700px)', zIndex: -1 }}
        >
          <motion.div className="absolute inset-0" style={{ opacity }}>
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Hali bosib o'tilmagan qism -- doimiy punktir, xira. */}
              <path
                d={PATH_D}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.4}
                strokeDasharray="3 3.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* Bosib o'tilgan qism -- yorqin gradient, scroll progress
                  bo'yicha yuqoridan pastga silliq "ochiladi". */}
              <motion.path
                d={PATH_D}
                fill="none"
                stroke="url(#snakeTrailGradient)"
                strokeWidth={1.8}
                strokeLinecap="round"
                pathLength={1}
                style={{ strokeDasharray: 1, strokeDashoffset: dashOffset }}
                vectorEffect="non-scaling-stroke"
              />
              <defs>
                <linearGradient id="snakeTrailGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#bfdbfe" />
                  <stop offset="55%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="var(--accent)" />
                </linearGradient>
              </defs>
            </svg>

            {/* Yorqin "kometa boshi" -- `position: sticky` orqali ekran
                vertikal markazida "yopishib" turadi (JS hisob-kitobsiz,
                brauzerning o'z tabiiy mexanizmi -- shuning uchun endi
                sudralib/orqada qolib harakatlanmaydi). Faqat gorizontal
                (`left`) pozitsiyasi to'lqin formulasiga qarab silliq
                chapga-o'ngga suriladi -- "ilon izi" harakati shundan. */}
            <div className="sticky" style={{ top: '50vh', height: 0 }}>
              <motion.div
                className="absolute"
                style={{ left: starLeft, top: 0, translateX: '-50%', translateY: '-50%' }}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: 22,
                    height: 22,
                    background: 'radial-gradient(circle at 35% 32%, #ffffff, #bfdbfe 35%, #60a5fa 70%, #3b82f6 100%)',
                    boxShadow:
                      '0 0 10px 3px #ffffff, 0 0 22px 8px #60a5fa, 0 0 44px 16px rgba(96,165,250,0.65), 0 0 72px 28px rgba(96,165,250,0.3)',
                  }}
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
      {children}
    </div>
  )
}
