'use client'

/* Kirish sahifasi uchun "ilon izi" (snake trail) scroll-effekti --
   crackd.it saytida ko'rgan effektga o'xshab: sahifa markazida, chapga-
   o'ngga tebranib pastga tushuvchi to'lqinsimon chiziq, uning ustida esa
   yorqin porlaydigan "kometa boshi" (yulduz) ko'rinadi. Chiziqning
   "bosib o'tilgan" qismi yorqin (gradient) bo'lib qoladi, hali yetib
   bormagan qismi esa punktir bo'lib turadi.

   4-versiyadagi vazifa: ikkita talab BIR VAQTDA bajarilishi kerak --
   (1) yulduz DOIM ekranning vertikal MARKAZIDA tursin (scroll qilinsa
   ham joyidan qo'zg'almasin), VA (2) rangli (ochilgan) chiziq AYNAN
   yulduz turgan joygacha yetib borsin -- ya'ni yulduz hech qachon
   "orqada qolib" ko'rinmasin.

   Bu ikkalasi ALOHIDA-ALOHIDA hal qilinsa bir-biriga to'g'ri kelmaydi:
   agar chiziq oddiy `scrollYProgress`ga (0=bo'lim boshi, 1=bo'lim oxiri)
   qarab ochilsa, u HUJJAT bo'yicha harakatlanadi -- lekin yulduz
   `sticky` bilan EKRAN markazida qolsa, ikkalasi boshqa-boshqa
   koordinatada bo'lib qoladi (aynan avvalgi versiyadagi xato shu edi).

   YECHIM -- matematik: "hozir ekranning vertikal markazida qanday
   hujjat nuqtasi turibdi" ni hisoblab, CHIZIQ aynan O'SHA nuqtagacha
   ochiladi (bu qiymatni `centerFrac` deb ataymiz):

     scrollY(progress) = containerTop + progress * (containerHeight - viewportHeight)
     markazdagi hujjat nuqtasi = scrollY + viewportHeight / 2
     centerFrac = (markazdagi hujjat nuqtasi - containerTop) / containerHeight
                = progress * (1 - viewportHeight/containerHeight)
                  + (viewportHeight / 2) / containerHeight

   `containerHeight` (o'ragich balandligi) va `viewportHeight` (ekran
   balandligi) haqiqiy piksellarda o'lchanadi (ResizeObserver + resize
   eventi orqali). Shu `centerFrac` bilan: (a) chiziqning ochilgan qismi
   (dashoffset) va (b) yulduzning gorizontal (to'lqin) pozitsiyasi
   hisoblanadi -- shuning uchun ular AYNAN bir xil hujjat nuqtasiga mos
   keladi. Yulduzning VERTIKAL joyi esa oddiy CSS `position: sticky;
   top: 50vh` bilan -- bu uni har doim ekran markazida ushlab turadi,
   hech qanday JS hisob-kitobsiz, 100% silliq.

   Natija: yulduz DOIM ekran markazida, VA rangli chiziq DOIM aynan
   yulduz turgan joygacha (na undan oldinroq, na undan keyinroq)
   ochiladi -- ikkalasi endi hech qachon ajralib qolmaydi.

   Bo'lim HALI boshlanmagan bo'lsa (foydalanuvchi hali Hero'da) --
   `opacity` 0, chiziq/yulduz umuman ko'rinmaydi, faqat scroll qila
   boshlagach paydo bo'ladi. */

import { useEffect, useRef, type ReactNode } from 'react'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'

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
  // Xom scroll signalini yumshatish -- tez scroll qilinganda ham
  // keskin sakramasdan, silliq harakat uchun.
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 32, mass: 0.4 })

  // O'ragich va ekran balandligini piksellarda kuzatib boramiz --
  // "hozir ekran markazida qaysi hujjat nuqtasi turibdi" formulasi
  // uchun kerak.
  const containerHeightRef = useRef(0)
  const viewportHeightRef = useRef(0)

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) containerHeightRef.current = containerRef.current.offsetHeight
      viewportHeightRef.current = window.innerHeight
    }
    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro && containerRef.current) ro.observe(containerRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [])

  // `centerFrac` -- ekran markazida hozir turgan hujjat nuqtasining
  // o'ragich balandligiga nisbatan foizi (0-1). Chiziq VA yulduz
  // gorizontal pozitsiyasi shu qiymatdan hisoblanadi, shuning uchun
  // ular hech qachon ajralib qolmaydi.
  const centerFrac = useMotionValue(0)
  useMotionValueEvent(progress, 'change', (p) => {
    const ch = containerHeightRef.current
    const vh = viewportHeightRef.current
    if (!ch) {
      centerFrac.set(p)
      return
    }
    const ratio = vh / ch
    const val = p * (1 - ratio) + ratio / 2
    centerFrac.set(Math.min(1, Math.max(0, val)))
  })

  const opacity = useTransform(progress, [0, 0.04], [0, 1])
  const starLeft = useTransform(centerFrac, (v) => `${waveX(v)}%`)
  const dashOffset = useTransform(centerFrac, (v) => 1 - v)

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
              {/* Bosib o'tilgan qism -- AYNAN "ekran markazidagi hujjat
                  nuqtasi"gacha (centerFrac) ochiladi -- shuning uchun
                  doim pastdagi yulduz turgan joyda tugaydi. */}
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

            {/* Yorqin "kometa boshi" -- `position: sticky; top: 50vh`
                orqali DOIM ekran vertikal markazida turadi (JS
                hisob-kitobsiz, brauzerning o'z mexanizmi). Gorizontal
                (`left`) pozitsiyasi esa `centerFrac`dan -- AYNAN SVG
                chizig'i qaysi nuqtagacha ochilgan bo'lsa, o'sha
                nuqtaning x-koordinatasi bilan bir xil formula
                (`waveX`) orqali hisoblanadi. Shuning uchun yulduz HAR
                DOIM chiziqning aynan ochilgan uchida turadi -- na
                oldinda, na orqada qolmaydi. */}
            <div className="sticky pointer-events-none" style={{ top: '50vh', height: 0 }}>
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
