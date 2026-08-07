'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

// SplitText -- matn'ni chars yoki words'ga bo'lib IntersectionObserver
// bilan viewport'ga kirganda GSAP stagger animatsiya bilan chiqaradi.
// Paid `SplitText` plugin talab qilmaydi -- manual split. Reduced-motion
// hurmat qilinadi (darrov final holatga o'tadi).

type SplitType = 'chars' | 'words'

type TransformProps = {
  opacity?: number
  x?: number
  y?: number
  rotationX?: number
  rotationY?: number
  scale?: number
}

interface SplitTextProps {
  tag?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'
  text: string
  className?: string
  delay?: number
  duration?: number
  ease?: string
  splitType?: SplitType
  from?: TransformProps
  to?: TransformProps
  threshold?: number
  textAlign?: 'left' | 'center' | 'right'
}

export default function SplitText({
  tag = 'h1',
  text,
  className,
  delay = 50,
  duration = 0.8,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  textAlign = 'center',
}: SplitTextProps) {
  const wrapperRef = useRef<HTMLElement | null>(null)

  useGSAP(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(wrapper.querySelectorAll('.split-unit'), to as gsap.TweenVars)
      return
    }
    const units = wrapper.querySelectorAll('.split-unit')
    gsap.set(units, from as gsap.TweenVars)

    let played = false
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting && !played) {
            played = true
            gsap.to(units, {
              ...(to as gsap.TweenVars),
              duration,
              ease,
              stagger: delay / 1000,
            })
            io.disconnect()
          }
        }
      },
      { threshold },
    )
    io.observe(wrapper)
    return () => io.disconnect()
  }, { scope: wrapperRef as React.MutableRefObject<HTMLElement>, dependencies: [text] })

  // Chars split -- har harf uchun inline-block span. Bo'shliqlarni
  // saqlash uchun ` ` (non-breaking space).
  const units = splitType === 'chars'
    ? Array.from(text).map((ch, i) => (
        <span
          key={i}
          className="split-unit"
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))
    : text.split(/(\s+)/).map((w, i) =>
        /^\s+$/.test(w)
          ? <span key={i}>{w}</span>
          : (
            <span
              key={i}
              className="split-unit"
              style={{ display: 'inline-block' }}
            >
              {w}
            </span>
          ),
      )

  // Static switch -- dynamic tag TS union too complex bo'lib qoldi va
  // ref type SVGSymbolElement bilan aralashib ketardi. Har tag alohida
  // narenderning.
  const commonProps = {
    className,
    style: { textAlign, perspective: 800 } as React.CSSProperties,
  }
  switch (tag) {
    case 'h2': return <h2 ref={wrapperRef as React.RefObject<HTMLHeadingElement>} {...commonProps}>{units}</h2>
    case 'h3': return <h3 ref={wrapperRef as React.RefObject<HTMLHeadingElement>} {...commonProps}>{units}</h3>
    case 'p':  return <p  ref={wrapperRef as React.RefObject<HTMLParagraphElement>} {...commonProps}>{units}</p>
    case 'span': return <span ref={wrapperRef as React.RefObject<HTMLSpanElement>} {...commonProps}>{units}</span>
    case 'div':  return <div  ref={wrapperRef as React.RefObject<HTMLDivElement>}  {...commonProps}>{units}</div>
    case 'h1':
    default:   return <h1 ref={wrapperRef as React.RefObject<HTMLHeadingElement>} {...commonProps}>{units}</h1>
  }
}
