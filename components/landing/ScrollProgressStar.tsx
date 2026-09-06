'use client'

/* Kirish sahifasi uchun "ilon izi" (snake trail) scroll-effekti --
   crackd.it saytida ko'rgan effektga o'xshab: sahifa markazida, chapga-
   o'ngga tebranib pastga tushuvchi to'lqinsimon chiziq, uning ustida esa
   yorqin porlaydigan "kometa boshi" (yulduz) ko'rinadi. Chiziqning
   "bosib o'tilgan" (yulduz ORQASIDA qoldirgan) qismi yorqin bo'lib
   qoladi, hali yetib bormagan (yulduz OLDIDA turgan) qismi esa punktir
   bo'lib turadi.

   6-versiyadagi ikkita tuzatish:

   1) YO'NALISH XATOSI (tuzatildi) -- avvalgi versiyada rangli chiziq
      `stroke-dasharray` + `stroke-dashoffset` "fokusi" orqali
      ochilardi. Nazariy jihatdan to'g'ri hisoblangan bo'lsa-da, amalda
      (brauzerda) rangli qism YULDUZNING OLDIDA (hali yetib
      borilmagan, pastdagi) tomonda chiqib qolgan edi -- foydalanuvchi
      buni to'g'ri payqagan: yulduz "chiziqning boshida" emas,
      deyarli oxirida ko'rinardi.

      YECHIM: endi hech qanday dash-offset "fokusi" ishlatilmaydi.
      Buning o'rniga, rangli chiziqning `d` (path) atributi HAR
      FREYMDA to'g'ridan-to'g'ri QAYTA QURILADI -- faqat t=0 (bo'lim
      boshi) dan t=centerFrac (yulduz turgan joy) gacha bo'lgan
      nuqtalardan. Bu usulda "qaysi tomon rangli" degan savol
      umuman tug'ilmaydi -- chiziq FAQAT yulduzgacha, ANIQ shu yergacha
      quriladi, undan naryog'i (kelajakdagi, pastdagi) qism boshqa
      <path> (xira punktir, statik fon) bilan ko'rsatiladi.

   2) "NUR SO'NIB QOLISH" (tuzatildi) -- oldingi versiyada rangli
      chiziqqa CSS `filter: drop-shadow(...)` qo'yilgan edi. Bu
      butun bo'lim balandligicha (necha ming piksel) cho'zilgan SVG
      ustida ba'zan notekis/uzuq-yuluq chizilishi (brauzerning katta
      filtrlangan elementlarni "plitka"lab render qilishidagi tanilgan
      muammosi) mumkin. Endi FILTR umuman ishlatilmaydi -- buning
      o'rniga oddiy, ishonchli usul: ikkita ustma-ust chiziq -- biri
      KENGROQ va XIRAROQ (halo/porlash effekti), ikkinchisi INGICHKA va
      YORQIN (o'zak chiziq). Bu "porlash" ko'rinishini filtrsiz, har
      qanday balandlikda barqaror beradi.

   Yulduzning o'zi CSS `position: sticky; top: 50vh` bilan DOIM ekran
   vertikal markazida turadi. Gorizontal joyi va chiziqning uzunligi
   bitta umumiy `centerFrac` qiymatidan kelib chiqadi -- bu qiymat har
   freymda `getBoundingClientRect()` orqali ANIQ (taxminiy emas)
   hisoblanadi: "hozir ekran markazida qaysi hujjat nuqtasi turibdi".

   Bo'lim HALI boshlanmagan bo'lsa (foydalanuvchi hali Hero'da) --
   `opacity` 0, chiziq/yulduz umuman ko'rinmaydi, faqat scroll qila
   boshlagach paydo bo'ladi. */

import { useEffect, useRef, type ReactNode } from 'react'
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// Chiziq markazdan chapga/o'ngga necha % (o'ragichning o'z kengligiga
// nisbatan) tebranadi -- kattaroq qiymat = kengroq "ilon izi".
const AMPLITUDE_PCT = 22
// Butun balandlik bo'ylab nechta to'liq to'lqin tsikli bo'lishi -- kichik
// bo'lim uchun ozroq, uzun bo'lim uchun ko'proq tsikl tabiiy ko'rinadi.
const WAVE_COUNT = 4
// Path silliqligi uchun namuna nuqtalar soni (to'liq chiziq uchun).
const STEPS = 80

function waveX(t: number): number {
  return 50 + AMPLITUDE_PCT * Math.sin(t * WAVE_COUNT * Math.PI * 2)
}

// t=0 dan t=tEnd gacha bo'lgan qismini quradi -- tEnd=1 bo'lsa butun
// (statik, fon) chiziq, tEnd=centerFrac bo'lsa "hozircha bosib
// o'tilgan" (rangli) qism. Oxirgi nuqta HAR DOIM aynan tEnd bo'ladi.
function buildWavePath(tEnd: number): string {
  if (tEnd <= 0) return ''
  const n = Math.max(1, Math.ceil(STEPS * tEnd))
  const parts: string[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * tEnd
    const x = waveX(t)
    const y = t * 100
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return parts.join(' ')
}

const FULL_PATH_D = buildWavePath(1)

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

  // Rangli (bosib o'tilgan) chiziqning ikkita nusxasi -- keng+xira
  // (halo) va ingichka+yorqin (o'zak). Ikkalasi ham HAR FREYMDA bitta
  // funksiyada, bitta `d`ga yangilanadi -- shuning uchun ular hamisha
  // bir xil, va yulduz bilan ham hech qachon ajralmaydi.
  const glowPathRef = useRef<SVGPathElement>(null)
  const corePathRef = useRef<SVGPathElement>(null)
  useMotionValueEvent(centerFrac, 'change', (v) => {
    const d = buildWavePath(Math.min(1, Math.max(0, v)))
    glowPathRef.current?.setAttribute('d', d)
    corePathRef.current?.setAttribute('d', d)
  })

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
              {/* Butun yo'l -- doimiy punktir, xira. Yulduzdan OLDINDA
                  (hali yetib borilmagan) qismi shu ko'rinishda qoladi. */}
              <path
                d={FULL_PATH_D}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.4}
                strokeDasharray="3 3.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* Bosib o'tilgan (yulduz ORQASIDA qolgan) qism -- t=0
                  dan aynan t=centerFrac (yulduz turgan joy) gacha
                  to'g'ridan-to'g'ri quriladi, hech qanday dash-offset
                  "fokuz"siz. Keng+xira "halo" qatlami filtrsiz porlash
                  ko'rinishini beradi. */}
              <path
                ref={glowPathRef}
                fill="none"
                stroke="#60a5fa"
                strokeOpacity={0.35}
                strokeWidth={5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                ref={corePathRef}
                fill="none"
                stroke="#bfe0ff"
                strokeWidth={1.8}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Yorqin "kometa boshi" -- `position: sticky; top: 50vh`
                orqali DOIM ekran vertikal markazida turadi. Gorizontal
                (`left`) pozitsiyasi `centerFrac`dan -- AYNAN chiziqning
                qurilgan uchi bilan bir xil `waveX` formulasi orqali --
                hisoblanadi, shuning uchun yulduz HAR DOIM chiziqning
                aynan uchida (boshida) turadi. */}
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
