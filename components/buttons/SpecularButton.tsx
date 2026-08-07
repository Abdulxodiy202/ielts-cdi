'use client'

import { useEffect, useRef, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react'

// SpecularButton -- gradient asosli tugma, ustida mouse'ga ergashadigan
// specular highlight (radial gradient). Mouse follow yopiq bo'lsa
// autoAnimate bilan gradient o'z-o'zidan aylanadi (2 minutlik cycle).
// Mobile'da mouse yo'q -- specular sekin aylanaverib turadi.

interface SpecularButtonProps {
  size?: 'sm' | 'md' | 'lg'
  radius?: number
  tint?: string
  tintOpacity?: number
  blur?: number
  textColor?: string
  lineColor?: string
  baseColor?: string
  intensity?: number
  shineSize?: number
  shineFade?: number
  thickness?: number
  speed?: number
  followMouse?: boolean
  proximity?: number
  autoAnimate?: boolean
  className?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  // Server komponentdan onClick uzatib bo'lmaydi (function serializatsiya
  // qilinmaydi) -- href bilan chaqirilsa <a> element render qilinadi.
  href?: string
  children: ReactNode
  style?: CSSProperties
}

const SIZE = {
  sm: { padY: 8,  padX: 16, font: 13 },
  md: { padY: 10, padX: 20, font: 14 },
  lg: { padY: 14, padX: 28, font: 15 },
} as const

export default function SpecularButton({
  size = 'md',
  radius = 12,
  tint = '#6366f1',
  tintOpacity = 0.15,
  textColor = '#ffffff',
  lineColor = '#a5b4fc',
  baseColor = '#4f46e5',
  intensity = 1.2,
  shineSize = 12,
  shineFade = 40,
  thickness = 1.5,
  speed = 0.4,
  followMouse = true,
  proximity = 300,
  autoAnimate = false,
  className,
  onClick,
  href,
  children,
  style,
}: SpecularButtonProps) {
  const ref = useRef<HTMLButtonElement | HTMLAnchorElement>(null)
  const s = SIZE[size]

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let mouseX = 50, mouseY = 50
    let auto = 0
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const setVars = (x: number, y: number) => {
      el.style.setProperty('--sb-x', `${x}%`)
      el.style.setProperty('--sb-y', `${y}%`)
    }

    const move = (e: MouseEvent) => {
      if (!followMouse) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
      if (dist > proximity) return
      mouseX = ((e.clientX - rect.left) / rect.width) * 100
      mouseY = ((e.clientY - rect.top) / rect.height) * 100
      setVars(mouseX, mouseY)
    }

    const tick = () => {
      auto += 0.008 * speed
      const x = 50 + Math.cos(auto) * 40
      const y = 50 + Math.sin(auto * 1.3) * 40
      setVars(x, y)
      raf = requestAnimationFrame(tick)
    }

    if (!reduce && autoAnimate) tick()
    if (!reduce && followMouse) window.addEventListener('mousemove', move)

    setVars(50, 50)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', move)
    }
  }, [followMouse, proximity, autoAnimate, speed])

  const shine = `radial-gradient(${shineSize * 8}px circle at var(--sb-x, 50%) var(--sb-y, 50%), ${lineColor}${Math.min(99, Math.round(intensity * 60)).toString(16).padStart(2, '0')} 0%, transparent ${shineFade}%)`

  const commonStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: `${s.padY}px ${s.padX}px`,
    borderRadius: radius,
    border: `${thickness}px solid ${lineColor}55`,
    background: `linear-gradient(135deg, ${baseColor}, ${tint})`,
    color: textColor,
    fontWeight: 600,
    fontSize: s.font,
    cursor: 'pointer',
    overflow: 'hidden',
    boxShadow: `0 8px 24px ${tint}55, inset 0 1px 0 ${lineColor}66`,
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    textDecoration: 'none',
    ...style,
  }

  const inner = (
    <>
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: tint, opacity: tintOpacity, pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: shine, mixBlendMode: 'screen', pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>{children}</span>
    </>
  )

  const hoverIn = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = 'translateY(-1px)' }
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.transform = '' }

  if (href) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={className}
        style={commonStyle}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        {inner}
      </a>
    )
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={onClick}
      className={className}
      style={commonStyle}
      onMouseEnter={hoverIn}
      onMouseLeave={hoverOut}
    >
      {inner}
    </button>
  )
}
