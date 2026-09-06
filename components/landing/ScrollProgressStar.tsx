'use client'

/* Kirish sahifasi uchun "ilon izi" (snake trail) scroll-effekti --
   crackd.it saytida ko'rgan effektga o'xshab: sahifa markazida, chapga-
   o'ngga tebranib pastga tushuvchi to'lqinsimon chiziq, uning ustida esa
   yorqin porlaydigan "kometa boshi" (yulduz) ko'rinadi. Chiziqning
   "bosib o'tilgan" qismi yorqin (gradient) bo'lib qoladi, hali yetib
   bormagan qismi esa punktir bo'lib turadi.

   3-versiyadagi XATO (tuzatildi): oldingi versiyada yulduzning VERTIKAL
   pozitsiyasi `position: sticky; top: 50vh` bilan ekran markaziga
   "yopishtirilgan" edi, lekin FON CHIZIG'I (SVG path, uning "ochilgan"
   -- porlagan -- qismi) hujjat (document) koordinatasida, oddiy scroll
   bilan siljib turardi. Bu IKKI XIL koordinata tizimi edi: chiziqning
   yorug' uchi (dash-reveal) bitta joyda, yulduzning o'zi esa BUTUNLAY
   BOSHQA joyda (ekran markazida) tugab qolardi -- shuning uchun
   foydalanuvchi "chiziq yulduzdan oldin ketyabdi, boshqa-boshqa joyda"
   deb to'g'ri payqagan edi.

   YECHIM: yulduz endi FON CHIZIG'I BILAN AYNAN BIR XIL formula va
   AYNAN BIR XIL koordinata tizimidan foydalanadi -- ya'ni ikkalasi ham
   xuddi shu `progress` qiymatidan `waveX(progress)` (gorizontal) va
   `progress*100%` (vertikal) orqali hisoblanadi. Shu sababli yulduz
   DOIM chiziqning aynan "ochilgan" uchida turadi -- hech qachon
   ajralib qolmaydi.

   "Sudralib qolish" muammosi (uzun bo'limda yulduz sekin harakatlanib
   ko'rinishi) esa boshqacha, to'g'riroq usul bilan yumshatildi:
   `useSpring` orqali xom scroll qiymatini "silliqlash" (smoothing) --
   bu yulduz VA chiziqni bab-baravar, tez scroll paytida ham keskin
   sakramasdan, biroz "erkin" (elastik) tarzda orqadan yetib olishga
   majbur qiladi -- lekin ikkalasi ALOHIDA emas, XUDDI BIR XIL smooth
   qiymatdan kelib chiqqani uchun ular hech qachon bir-biridan
   ajralmaydi, faqat harakat umuman silliqroq bo'ladi.

   Bo'lim HALI boshlanmagan bo'lsa (foydalanuvchi hali Hero'da, pastga
   scroll qilmagan) progress = 0 va `opacity` ham 0 -- shuning uchun
   boshida chiziq/yulduz umuman ko'rinmaydi, faqat scroll qila
   boshlagach paydo bo'ladi. */

import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'

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

  // MUHIM: pastdagi HAMMA qiymat (opacity, chiziq reveal, yulduzning
  // left VA top'i) shu BITTA `progress`dan kelib chiqadi -- shuning
  // uchun ular hech qachon bir-biridan ajralmaydi. `useSpring` xom
  // scroll signalini yumshatadi (tez scroll'da keskin sakrash o'rniga
  // silliq "erkin" harakat) -- lekin baribir bitta manba bo'lgani
  // uchun chiziq va yulduz doim sinxron qoladi.
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 32, mass: 0.4 })

  const opacity = useTransform(progress, [0, 0.04], [0, 1])
  const starLeft = useTransform(progress, (v) => `${waveX(v)}%`)
  const starTop = useTransform(progress, (v) => `${v * 100}%`)
  const dashOffset = useTransform(progress, (v) => 1 - v)

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
              {/* Bosib o'tilgan qism -- yorqin gradient, `progress`
                  bo'yicha yuqoridan pastga silliq "ochiladi". Yulduz
                  DOIM shu chiziqning tugagan (ochilgan) uchida turadi,
                  chunki ikkalasi ham bir xil `progress`dan hisoblanadi. */}
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

            {/* Yorqin "kometa boshi" -- left VA top ikkalasi ham AYNAN
                yuqoridagi SVG path'ni chizishda ishlatilgan formula
                bilan (waveX(progress), progress*100%) hisoblanadi --
                shuning uchun yulduz matematik jihatdan HAR DOIM
                chiziqning ustida, aynan uning "ochilgan" uchida turadi. */}
            <motion.div
              className="absolute"
              style={{ left: starLeft, top: starTop, translateX: '-50%', translateY: '-50%' }}
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
          </motion.div>
        </div>
      )}
      {children}
    </div>
  )
}
