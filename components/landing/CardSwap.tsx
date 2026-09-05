'use client'

/* CardSwap -- uchburchak (3D) qalin karta-stack animatsiyasi (gsap asosida).
   Manba: foydalanuvchi taqdim etgan tayyor "React Bits" CardSwap komponenti
   (JS) -- shu loyihaning TypeScript/Next.js konventsiyalariga moslab qayta
   yozilgan (turlar qo'shildi, CSS o'zgaruvchilarga bog'landi).

   Qo'shimcha: prefers-reduced-motion yoqilgan foydalanuvchilarda avtomatik
   almashish (interval) butunlay o'chiriladi -- kartalar shunchaki
   joylashtirilgan holatda, statik ko'rinadi (hech qanday sakrash/aylanish
   bo'lmaydi). Original kod bunga e'tibor bermagan edi, biz qo'shdik.

   `onActiveChange` -- har safar eng oldingi (faol) karta almashganda uning
   asl indeksini beradi, shu orqali tashqi komponent (masalan, yon matn)
   joriy rasmga sinxron holda yangilanishi mumkin. */

import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'
import gsap from 'gsap'
import './CardSwap.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  customClass?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ customClass, ...rest }, ref) => (
  // MUHIM: bu yerda umumiy "card" klassi ATAYLAB ishlatilmaydi -- loyihada
  // globals.css'dagi saytning umumiy .card utility klassi (dashboard,
  // pricing, feature kartalari va h.k. hammasi shundan foydalanadi) bilan
  // NOM to'qnashuvi bo'lgan edi. CardSwap.css'dagi .card{position:absolute...}
  // qoidasi @layer'siz (oddiy) yozilgani uchun CSS qoidasiga ko'ra u
  // globals.css'ning @layer components ichidagi .card'dan HAR DOIM ustun
  // chiqadi -- natijada BUTUN saytdagi .card klassli elementlar sahifa
  // markaziga "yopishtirilib", bir-birining ustiga tushib qolgan edi
  // (pricing/feature/band-table kartalari, dashboard'dagi referral va
  // leaderboard overlap -- hammasi shu bitta sababdan). Shuning uchun bu
  // komponent endi faqat o'ziga xos "card-swap-item" klassidan foydalanadi.
  <div ref={ref} {...rest} className={`card-swap-item ${customClass ?? ''} ${rest.className ?? ''}`.trim()} />
))
Card.displayName = 'Card'

interface Slot {
  x: number
  y: number
  z: number
  zIndex: number
}

const makeSlot = (i: number, distX: number, distY: number, total: number): Slot => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
})

const placeNow = (el: HTMLDivElement, slot: Slot, skew: number) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  })

export interface CardSwapProps {
  width?: number | string
  height?: number | string
  cardDistance?: number
  verticalDistance?: number
  delay?: number
  pauseOnHover?: boolean
  onCardClick?: (idx: number) => void
  // Har safar eng oldingi (faol) karta almashganda chaqiriladi -- yangi
  // faol kartaning asl (children ichidagi) indeksini beradi. Masalan,
  // shu indeksdan foydalanib chap tomondagi matnni joriy rasmga mos
  // ravishda yangilash mumkin.
  onActiveChange?: (idx: number) => void
  skewAmount?: number
  easing?: 'elastic' | 'linear'
  children: ReactNode
}

const CardSwap = ({
  width = 500,
  height = 400,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  pauseOnHover = false,
  onCardClick,
  onActiveChange,
  skewAmount = 6,
  easing = 'elastic',
  children,
}: CardSwapProps) => {
  const config =
    easing === 'elastic'
      ? {
          ease: 'elastic.out(0.6,0.9)',
          durDrop: 2,
          durMove: 2,
          durReturn: 2,
          promoteOverlap: 0.9,
          returnDelay: 0.05,
        }
      : {
          ease: 'power1.inOut',
          durDrop: 0.8,
          durMove: 0.8,
          durReturn: 0.8,
          promoteOverlap: 0.45,
          returnDelay: 0.2,
        }

  const childArr = useMemo(() => Children.toArray(children) as ReactElement<CardProps>[], [children])
  const refs = useMemo<RefObject<HTMLDivElement | null>[]>(
    () => childArr.map(() => React.createRef<HTMLDivElement>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childArr.length]
  )
  const order = useRef<number[]>(Array.from({ length: childArr.length }, (_, i) => i))
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  // number aniq belgilangan -- ReturnType<typeof setInterval> ishlatilmaydi,
  // chunki loyihada @types/node ham mavjud va bu holda TypeScript ba'zan
  // Node'ning "Timeout" turini DOM'ning "number" turi bilan chalkashtirib,
  // "Type 'number' is not assignable to type 'Timeout'" xatosini beradi.
  // Bu komponent faqat brauzerda ('use client') ishlaydi, shuning uchun
  // window.setInterval har doim number qaytaradi.
  const intervalRef = useRef<number | undefined>(undefined)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const total = refs.length
    refs.forEach((r, i) => {
      if (r.current) placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount)
    })

    // Boshlang'ich holatda eng oldingi (0-indeksli) karta faol -- chaqiruvchi
    // tomon (masalan, chap tomondagi matn) shu bilan sinxronlanadi.
    if (total > 0) onActiveChange?.(order.current[0])

    // Kamaytirilgan harakat yoqilgan bo'lsa yoki bitta kartadan kam bo'lsa --
    // hech qanday avtomatik aylanish/timer ishga tushirilmaydi.
    if (reduceMotion || total < 2) return

    const swap = () => {
      if (order.current.length < 2) return
      const [front, ...rest] = order.current
      const elFront = refs[front]?.current
      if (!elFront) return

      // MUHIM: `onActiveChange` endi animatsiya TUGAGANDA emas, balki
      // almashish BOSHLANGANDA (shu yerda, darhol) chaqiriladi.
      //
      // Avval bu chaqiruv timeline oxirida (~2.3s dan keyin, butun
      // "tushish + qaytish" animatsiyasi tugagach) turardi. Lekin yangi
      // oldingi karta ("promote" bosqichi) allaqachon ~0.2s-2.2s oralig'ida
      // ko'rinadigan joyga chiqib bo'lardi -- ya'ni rasm allaqachon
      // almashgan, lekin chap tomondagi matn hali eski rasmning
      // sarlavhasini ko'rsatardi (+ framer-motion'ning fade animatsiyasi
      // yana ~0.7s qo'shib, matnni yanada orqada qoldirardi). Natijada
      // foydalanuvchi "matn boshqa rasmga to'g'ri kelib qolyapti" deb
      // shikoyat qildi. Endi order/callback aynan shu yerda -- gsap
      // animatsiyasi hali boshlanmasdan turib -- yangilanadi, shunda matn
      // rasm bilan bir vaqtda (yoki undan ozgina oldinroq) o'zgaradi.
      order.current = [...rest, front]
      onActiveChange?.(order.current[0])

      const tl = gsap.timeline()
      tlRef.current = tl
      tl.to(elFront, { y: '+=500', duration: config.durDrop, ease: config.ease })
      tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`)
      rest.forEach((idx, i) => {
        const el = refs[idx]?.current
        if (!el) return
        const slot = makeSlot(i, cardDistance, verticalDistance, refs.length)
        tl.set(el, { zIndex: slot.zIndex }, 'promote')
        tl.to(
          el,
          { x: slot.x, y: slot.y, z: slot.z, duration: config.durMove, ease: config.ease },
          `promote+=${i * 0.15}`
        )
      })
      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length)
      tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`)
      tl.call(
        () => {
          gsap.set(elFront, { zIndex: backSlot.zIndex })
        },
        undefined,
        'return'
      )
      tl.to(
        elFront,
        { x: backSlot.x, y: backSlot.y, z: backSlot.z, duration: config.durReturn, ease: config.ease },
        'return'
      )
    }

    swap()
    intervalRef.current = window.setInterval(swap, delay)

    if (pauseOnHover) {
      const node = container.current
      const pause = () => {
        tlRef.current?.pause()
        clearInterval(intervalRef.current)
      }
      const resume = () => {
        tlRef.current?.play()
        intervalRef.current = window.setInterval(swap, delay)
      }
      node?.addEventListener('mouseenter', pause)
      node?.addEventListener('mouseleave', resume)
      return () => {
        node?.removeEventListener('mouseenter', pause)
        node?.removeEventListener('mouseleave', resume)
        clearInterval(intervalRef.current)
      }
    }
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing, refs, onActiveChange])

  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          key: i,
          // `as any` -- React 19'ning cloneElement turlari 'ref'ni
          // Partial<CardProps> & Attributes ichida "noma'lum xususiyat"
          // deb hisoblaydi (forwardRef orqali yaratilgan komponent uchun
          // generic tur query'da ref avtomatik chiqarilmaydi). Ishlash
          // vaqtida forwardRef orqali ref to'g'ri uzatiladi -- bu faqat
          // qattiqlashtirilgan overload tekshiruvini chetlab o'tish.
          ref: refs[i],
          style: { width, height, ...(child.props.style ?? {}) },
          onClick: (e: ReactMouseEvent<HTMLDivElement>) => {
            child.props.onClick?.(e)
            onCardClick?.(i)
          },
        } as any)
      : child
  )

  return (
    <div ref={container} className="card-swap-container" style={{ width, height }}>
      {rendered}
    </div>
  )
}

export default CardSwap
