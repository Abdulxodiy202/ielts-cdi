'use client'

/* CardSwap -- uchburchak (3D) qalin karta-stack animatsiyasi (gsap asosida).
   Manba: foydalanuvchi taqdim etgan tayyor "React Bits" CardSwap komponenti
   (JS) -- shu loyihaning TypeScript/Next.js konventsiyalariga moslab qayta
   yozilgan (turlar qo'shildi, CSS o'zgaruvchilarga bog'landi).

   Qo'shimcha: prefers-reduced-motion yoqilgan foydalanuvchilarda avtomatik
   almashish (interval) butunlay o'chiriladi -- kartalar shunchaki
   joylashtirilgan holatda, statik ko'rinadi (hech qanday sakrash/aylanish
   bo'lmaydi). Original kod bunga e'tibor bermagan edi, biz qo'shdik. */

import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
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
  <div ref={ref} {...rest} className={`card ${customClass ?? ''} ${rest.className ?? ''}`.trim()} />
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
  const intervalRef = useRef<ReturnType<typeof window.setInterval> | undefined>(undefined)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const total = refs.length
    refs.forEach((r, i) => {
      if (r.current) placeNow(r.current, makeSlot(i, cardDistance, verticalDistance, total), skewAmount)
    })

    // Kamaytirilgan harakat yoqilgan bo'lsa yoki bitta kartadan kam bo'lsa --
    // hech qanday avtomatik aylanish/timer ishga tushirilmaydi.
    if (reduceMotion || total < 2) return

    const swap = () => {
      if (order.current.length < 2) return
      const [front, ...rest] = order.current
      const elFront = refs[front]?.current
      if (!elFront) return
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
      tl.call(() => {
        order.current = [...rest, front]
      })
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
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing, refs])

  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child, {
          key: i,
          ref: refs[i],
          style: { width, height, ...(child.props.style ?? {}) } as CSSProperties,
          onClick: (e: ReactMouseEvent<HTMLDivElement>) => {
            child.props.onClick?.(e)
            onCardClick?.(i)
          },
        })
      : child
  )

  return (
    <div ref={container} className="card-swap-container" style={{ width, height }}>
      {rendered}
    </div>
  )
}

export default CardSwap
