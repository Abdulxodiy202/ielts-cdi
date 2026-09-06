'use client'

/* Kirish sahifasi uchun "ilon izi" (snake trail) scroll-effekti --
   crackd.it saytida ko'rgan effektga o'xshab: sahifa markazida, chapga-
   o'ngga tebranib pastga tushuvchi to'lqinsimon chiziq, uning ustida esa
   yorqin porlaydigan "kometa boshi" (yulduz) joriy scroll pozitsiyasini
   ko'rsatadi. Yulduz bosib o'tgan qism yorqin (gradient) chiziq bo'lib
   qoladi, hali yetib bormagan qismi esa punktir bo'lib turadi.

   Ishlash tamoyili:
   - `<ScrollSnakeTrail>` bilan bir nechta bo'lim (Showcase, Features,
     Band Table, Pricing) o'raladi. Shu o'ragich elementning balandligi
     BUTUN shu bo'limlar yig'indisiga teng bo'ladi.
   - `useScroll({ target, offset: ['start start', 'end end'] })` --
     progress shu elementning YUQORISI ekran yuqorisiga tegganda 0,
     PASTKI qismi ekran pastiga tegganda 1 bo'ladi. Bu formula matematik
     jihatdan foydali xususiyatga ega: agar yulduzni shu progress'ning
     % qiymati bo'yicha o'ragich ICHIDA (0%-100%) joylashtirsak, u DOIM
     ekranning vertikal MARKAZIDA ko'rinadi -- qo'shimcha `position:
     sticky` yoki piksel hisoblashlar shart emas.
   - Bo'lim HALI boshlanmagan bo'lsa (ya'ni foydalanuvchi hali Hero'da,
     pastga scroll qilmagan bo'lsa) progress = 0, va shu holatda
     `opacity` ham 0 qilib qo'yilgan -- shuning uchun boshida chiziq
     umuman ko'rinmaydi, faqat scroll qila boshlagach paydo bo'ladi.
   - Chiziqning o'zi SVG `<path>` orqali chizilgan -- sinusoidal
     to'lqin formulasi bilan, viewBox "0 0 100 100" (preserveAspectRatio
     "none") ichida. Yulduzning `left`/`top` pozitsiyasi ham AYNAN SHU
     FORMULA bilan hisoblanadi, shuning uchun yulduz doim chiziqning
     ustida turadi. `pathLength="1"` + `strokeDashoffset` orqali
     "bosib o'tilgan" qism progress'ga qarab silliq ochiladi. */

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
  const starTop = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
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

            {/* Yorqin "kometa boshi" -- referens rasmdagi kometaga o'xshab,
                yorqin oq-ko'k yadro + bir necha qatlamli tashqi porlash
                (glow). Avvalgi versiyadan sezilarli kattaroq va yorqinroq. */}
            <motion.div
              className="absolute"
              style={{ left: starLeft, top: starTop, translateX: '-50%', translateY: '-50%' }}
            >
              <span
                className="block rounded-full"
                style={{
                  width: 20,
                  height: 20,
                  background: 'radial-gradient(circle at 35% 32%, #ffffff, #bfdbfe 35%, #60a5fa 70%, #3b82f6 100%)',
                  boxShadow:
                    '0 0 8px 2px #ffffff, 0 0 18px 6px #60a5fa, 0 0 38px 14px rgba(96,165,250,0.6), 0 0 64px 24px rgba(96,165,250,0.28)',
                }}
              />
            </motion.div>
          </motion.div>
        </div>
      )}
      {children}
    </div>
  )
}
