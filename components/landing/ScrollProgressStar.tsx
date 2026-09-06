'use client'

/* Kirish sahifasi uchun "ilon izi" (snake trail) scroll-effekti --
   crackd.it saytida ko'rgan effektga o'xshab: sahifa markazida, chapga-
   o'ngga tebranib pastga tushuvchi to'lqinsimon chiziq, uning ustida esa
   yorqin porlaydigan "kometa boshi" (yulduz) ko'rinadi. Chiziqning
   "bosib o'tilgan" qismi yorqin bo'lib qoladi, hali yetib bormagan
   qismi esa punktir bo'lib turadi.

   5-versiyadagi ikkita tuzatish:

   1) ANIQ (taxminiy emas) moslashuv -- avvalgi versiyada "ekran
      markazida hozir qaysi hujjat nuqtasi turibdi" degan qiymat
      `scrollYProgress`dan ANALITIK FORMULA orqali (taxminiy) hisoblanar
      edi. Endi bu qiymat har animatsiya freymida (`requestAnimationFrame`)
      TO'G'RIDAN-TO'G'RI `getBoundingClientRect()` orqali -- ya'ni
      brauzerning o'zi bergan HAQIQIY piksel o'lchovi bilan -- hisoblanadi:

        el.getBoundingClientRect().top  -- o'ragichning hozir ekranga
                                            nisbatan qayerdaligi
        window.innerHeight              -- ekranning haqiqiy balandligi

        markazdagi hujjat nuqtasi (ekran yuqorisidan) = -rect.top + vh/2
        centerFrac = shu qiymat / rect.height   (0 dan 1 gacha, kesilgan)

      Bu qiymat orqali HAM chiziqning ochilishi (dashoffset), HAM
      yulduzning gorizontal joyi (`waveX`) hisoblanadi -- ikkalasi bir
      xil, ANIQ manbadan kelgani uchun endi hech qachon ajralib
      qolmaydi. Yulduzning o'zi esa CSS `position: sticky; top: 50vh`
      bilan ekran markazida turadi.

   2) Chiziqning rangi endi DOIM BIR XIL (statik, dinamik gradient
      emas) -- avval "bosib o'tilgan" qism sahifadagi ABSOLYUT
      joylashuviga qarab rangini o'zgartirardi (yuqorida ochroq ko'k,
      pastda boshqacha rang) - bu esa yulduz atrofidagi chiziqni
      ba'zan xira/kutilmagan rangda ko'rsatardi. Endi bitta qat'iy,
      yorqin rangda (`#60a5fa`, yulduzning o'z rangi bilan mos) --
      qayerda bo'lishidan qat'i nazar doim bir xil ko'rinadi.

   Bo'lim HALI boshlanmagan bo'lsa (foydalanuvchi hali Hero'da) --
   `opacity` 0, chiziq/yulduz umuman ko'rinmaydi, faqat scroll qila
   boshlagach paydo bo'ladi. */

import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

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

  // "Ekran markazida hozir qaysi hujjat nuqtasi turibdi" -- har freymda
  // HAQIQIY piksel o'lchovlaridan (taxminiy formula emas) hisoblanadi.
  const rawCenterFrac = useMotionValue(0)

  useEffect(() => {
    if (reduce) return
    let frameId = 0
    const update = () => {
      const el = containerRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const vh = window.innerHeight
        const docYAtCenter = -rect.top + vh / 2
        const frac = rect.height > 0 ? docYAtCenter / rect.height : 0
        rawCenterFrac.set(Math.min(1, Math.max(0, frac)))
      }
      frameId = requestAnimationFrame(update)
    }
    frameId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frameId)
  }, [reduce, rawCenterFrac])

  // Yumshatish (spring) -- tez scroll qilinganda ham keskin sakramasdan
  // silliq harakat uchun. Chiziq VA yulduz ikkalasi ham AYNAN shu bitta
  // silliqlangan qiymatdan hisoblanadi -- shuning uchun ular hech qachon
  // ajralib qolmaydi.
  const centerFrac = useSpring(rawCenterFrac, { stiffness: 220, damping: 32, mass: 0.4 })

  const opacity = useTransform(centerFrac, [0, 0.03], [0, 1])
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
                  nuqtasi"gacha (centerFrac) ochiladi, shuning uchun doim
                  pastdagi yulduz turgan joyda tugaydi. Rangi ENDI BITTA
                  QAT'IY rangda (dinamik gradient emas) -- sahifadagi
                  joyidan qat'i nazar doim bir xil ko'rinadi. */}
              <motion.path
                d={PATH_D}
                fill="none"
                stroke="#60a5fa"
                strokeWidth={1.8}
                strokeLinecap="round"
                pathLength={1}
                style={{
                  strokeDasharray: 1,
                  strokeDashoffset: dashOffset,
                  filter: 'drop-shadow(0 0 4px rgba(96,165,250,0.65))',
                }}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Yorqin "kometa boshi" -- `position: sticky; top: 50vh`
                orqali DOIM ekran vertikal markazida turadi. Gorizontal
                (`left`) pozitsiyasi esa `centerFrac`dan -- AYNAN SVG
                chizig'i qaysi nuqtagacha ochilgan bo'lsa, o'sha
                nuqtaning x-koordinatasi bilan bir xil formula
                (`waveX`) orqali hisoblanadi. Shuning uchun yulduz HAR
                DOIM chiziqning aynan ochilgan uchida turadi. */}
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
