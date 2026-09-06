'use client'

/* Kirish sahifasi uchun "ilon izi" (snake trail) scroll-effekti --
   crackd.it saytida ko'rgan effektga o'xshab: sahifa markazida, chapga-
   o'ngga tebranib pastga tushuvchi to'lqinsimon chiziq, uning ustida esa
   yorqin porlaydigan "kometa" ko'rinadi. Chiziqning "bosib o'tilgan"
   qismi yorqin (gradient) bo'lib qoladi, hali yetib bormagan qismi esa
   punktir bo'lib turadi.

   2-versiyadagi XATO (tuzatildi): yulduzning VERTIKAL pozitsiyasi avval
   `top: progress*100%` deb, scroll progress'dan har freym'da JS orqali
   hisoblanardi. Bu matematik jihatdan quyidagi muammoni keltirib
   chiqargan edi: agar o'ragilgan bo'lim balandligi ekran balandligidan
   N marta katta bo'lsa (masalan 5 marta), yulduz ekran ichida atigi
   1/N tezlikda harakatlanadi -- ya'ni atrofdagi kontent tabiiy tezlikda
   yuqoriga siljisa, yulduz "sudralib qolganday" sekin harakatlanadi.
   YECHIM: `position: sticky` + `top: 50vh` -- brauzerning o'zi hal
   qiladigan, hech qanday JS hisob-kitobsiz, 100% silliq usul.

   3-versiya (bu fayl) — "jonli kometa":
   Avvalgi implementatsiyada shunchaki bir dumaloq radial-gradient
   nuqta bor edi -- "shooting star" hissiyoti umuman bermayotgan edi.
   Endi kometa 3 qatlamli SVG bilan chiziladi:
     1) DUMI (tail) — cho'zilgan ellips, tepasi to'liq transparent
        pastga tomon yorqinlashib boradi. `rotate` bilan mahalliy path
        qiyaligi bo'yicha buriladi -- shuning uchun harakat yo'nalishiga
        qarshi ko'rinadi ("shooting star" printsipi: dum orqada qoladi,
        head'ni ta'qib qilib turibdi).
     2) YORQIN YADRO (head) — asosiy radial-gradient sharcha, tail
        rotatsiyasidan qat'iy nazar dumaloq ko'rinadi.
     3) GLOW HALO — CSS box-shadow bilan alohida div. `animate` bilan
        doimiy nafas oladi (scale/opacity pulsatsiya) -- foydalanuvchi
        scroll qilmayotgan bo'lsa ham kometa "tirik" ko'rinishi uchun.
   Butun wrapper esa yengil vertikal tebranadi (`y` motion) -- sticky
   pinning'ni yumshatib, "hech nima qotib qolmagan" effekti beradi.

   Path tangenti: waveX(t) = 50 + A*sin(t*W*2π) bo'lgani uchun
   d(waveX)/dt = A*W*2π*cos(t*W*2π). Bu son harakatning gorizontal
   tarkibiy qismini beradi; vertikal tarkib esa doimiy (yuqoridan
   pastga scroll). Real pikselda o'ragich kengligi ~700px, uzunligi
   esa bir necha viewport bo'lishi mumkin, shuning uchun angle ni
   `atan(dx/dy)` orqali emas, empirik nisbat bilan hisoblaymiz --
   +35°..-35° oralig'ida silliq harakatlanish visually eng "shooting
   star" ko'rinishga o'xshaydi.

   Reduced-motion: butun blok null qaytaradi -- animatsiya HAM, dekorativ
   chiziq HAM ko'rinmaydi. Mobil (lg dan pastda) `hidden lg:block` bilan
   yashiriladi. Kontentga hech qachon tegmaydi (pointer-events: none). */

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
// Kometa dumini qanchalik qattiq burish. Empirik: 35° ± ni oshirsak
// tail siniq/g'alati sinuvchi ko'rinadi, kamaytirsak "shooting star"
// hissi yo'qoladi.
const TAIL_MAX_TILT_DEG = 35

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
  // Tail tilt: waveX'ning t bo'yicha hosilasi = A*W*2π*cos(t*W*2π).
  // Cos'ning o'zi [-1..1] oralig'ida, shuning uchun uni to'g'ridan-to'g'ri
  // TAIL_MAX_TILT_DEG ga ko'paytirib rotation degre'ga aylantiramiz.
  // Manfiy belgi -- dum HARAKAT YO'NALISHIGA QARSHI bo'lishi uchun
  // (kometa o'ngga ketayotgan bo'lsa, dumi chapda qoladi).
  const tailRotate = useTransform(scrollYProgress, (v) =>
    -Math.cos(v * WAVE_COUNT * Math.PI * 2) * TAIL_MAX_TILT_DEG
  )

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

            {/* Kometa wrapper -- `position: sticky` orqali ekran vertikal
                markazida "yopishib" turadi. Faqat gorizontal (`left`)
                pozitsiyasi to'lqin formulasiga qarab silliq chapga-o'ngga
                suriladi -- "ilon izi" harakati shundan. Ustiga yengil
                vertikal bob (y ± 4px) qo'shilgan -- foydalanuvchi scroll
                qilmasa ham kometa muzlab qolmasin. */}
            <div className="sticky" style={{ top: '50vh', height: 0 }}>
              <motion.div
                className="absolute"
                style={{ left: starLeft, top: 0, translateX: '-50%', translateY: '-50%' }}
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* Comet container -- 1) glow halo (CSS box-shadow),
                    2) SVG dum + yorqin yadro. Ikkalasi ham bir xil (0,0)
                    koordinatasida joylashadi, o'ram markazlashtiruvchi
                    -translate bilan sirt markazida. */}
                <div style={{ position: 'relative', width: 30, height: 30 }}>
                  {/* GLOW HALO -- doimiy nafas oladigan yorug'lik gardish.
                      Framer Motion'ning infinite animate'i scroll'dan
                      butunlay mustaqil: foydalanuvchi harakatsiz tursa
                      ham kometa "tirik" ko'rinadi. Faqat glow scale/
                      opacity o'zgaradi -- yadro (head) sharcha o'zi
                      o'zgarmasin, chunki uning o'lchami "shooting star"
                      identifikatori. */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: '50%', left: '50%',
                      width: 14, height: 14,
                      marginTop: -7, marginLeft: -7,
                      borderRadius: '50%',
                      background: 'transparent',
                      boxShadow:
                        '0 0 10px 3px #ffffff, 0 0 22px 8px #93c5fd, 0 0 44px 16px rgba(96,165,250,0.55), 0 0 78px 30px rgba(96,165,250,0.25)',
                    }}
                    animate={{ scale: [1, 1.18, 1], opacity: [0.75, 1, 0.75] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  {/* DUMLI KOMETA SVG'si. viewBox -15..15 x -110..15:
                      yadro (head) (0,0) da, dum yuqoriga cho'zilgan
                      (y=-110 gacha to'liq transparent). Rotate `tailRotate`
                      wrapper <g>'ga qo'llanadi -- head o'z joyida qoladi,
                      dum uning atrofida silliq siljib turadi. */}
                  <svg
                    width={30} height={125}
                    viewBox="-15 -110 30 125"
                    style={{
                      position: 'absolute',
                      top: '50%', left: '50%',
                      // SVG'ni head markazi (0,0) coordinate koordinatasi
                      // wrapper'ning geometrik markazida bo'lishi uchun --
                      // width 30, dum 110 tepada + head 15 pastda = 125
                      // total; head y=0 esa svg ichida "pastdan 15px".
                      transform: 'translate(-50%, calc(-100% + 15px))',
                      overflow: 'visible',
                    }}
                  >
                    <defs>
                      <linearGradient id="cometTailGrad" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.95" />
                        <stop offset="25%"  stopColor="#dbeafe" stopOpacity="0.75" />
                        <stop offset="55%"  stopColor="#93c5fd" stopOpacity="0.4" />
                        <stop offset="85%"  stopColor="#60a5fa" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                      <radialGradient id="cometHeadGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"  stopColor="#ffffff" />
                        <stop offset="45%" stopColor="#dbeafe" />
                        <stop offset="80%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </radialGradient>
                    </defs>

                    {/* Butun kometa (dum + yadro) bir <g> ichida --
                        rotate head atrofida bo'ladi (transform-origin
                        (0,0) = head markazi). */}
                    <motion.g style={{ rotate: tailRotate, originX: '0px', originY: '0px' }}>
                      {/* DUM -- yorqin yadrodan yuqoriga (y=-95 gacha)
                          cho'zilgan, tepasi to'liq transparent.
                          Ellipsning rx (kenglik) 5, ry (uzunlik) 50 --
                          cho'zilgan konus effekti. Yadro joyida rx bilan
                          "tugash" uchun bottom edge y=5 gacha yetadi. */}
                      <ellipse
                        cx={0}
                        cy={-48}
                        rx={5}
                        ry={55}
                        fill="url(#cometTailGrad)"
                      />
                      {/* Ingichka, yorqinroq "core streak" -- ikkinchi
                          ellipse yadrodan chiqib turgan yorug'lik zarbi
                          (dum ichida markaziy porloq chiziq). Optik
                          jihatdan dumga "kuch" beradi. */}
                      <ellipse
                        cx={0}
                        cy={-38}
                        rx={1.6}
                        ry={40}
                        fill="url(#cometTailGrad)"
                        opacity={0.85}
                      />
                      {/* Yadro (head) -- rotatsiya markazida joylashgan
                          radial gradient sharcha. */}
                      <circle cx={0} cy={0} r={7} fill="url(#cometHeadGrad)" />
                    </motion.g>
                  </svg>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
      {children}
    </div>
  )
}
