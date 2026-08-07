'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'

// Electric border -- SVG feTurbulence + feDisplacementMap ustida
// jonli chizib turadigan border. Border rangi color prop bilan,
// tezligi speed (0.5..2), noise darajasi chaos (0..1). React Bits
// naqshining reversiya-toza inline SVG variantidir. useId har
// instans uchun unique filter id beradi -- ikki border bir sahifada
// mustaqil harakat qiladi.

interface ElectricBorderProps {
  color?: string
  speed?: number
  chaos?: number
  thickness?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function ElectricBorder({
  color = '#6366f1',
  speed = 1,
  chaos = 0.15,
  thickness = 2,
  className,
  style,
  children,
}: ElectricBorderProps) {
  const filterId = 'eb-' + useId().replace(/[:]/g, '')
  // seed animation duration -- tez chaos -> qisqa cycle
  const durX = (6 / Math.max(0.25, speed)).toFixed(2)
  const durY = (7 / Math.max(0.25, speed)).toFixed(2)
  const baseFreq = (0.02 + chaos * 0.05).toFixed(4)

  return (
    <div
      className={className}
      style={{ position: 'relative', ...style }}
    >
      {/* Border layer -- absolute, ustidagi bola content'ga tegmaydi */}
      <svg
        aria-hidden
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
      >
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency={baseFreq} numOctaves="2" seed="7" result="noise">
              <animate attributeName="baseFrequency" values={`${baseFreq};${(parseFloat(baseFreq) * 1.6).toFixed(4)};${baseFreq}`} dur={`${durX}s`} repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={String(6 + chaos * 24)} xChannelSelector="R" yChannelSelector="G">
              <animate attributeName="scale" values={`${6 + chaos * 12};${18 + chaos * 24};${6 + chaos * 12}`} dur={`${durY}s`} repeatCount="indefinite" />
            </feDisplacementMap>
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
      </svg>

      {/* Glow -- border ostidagi rangdor blur */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 'inherit',
          background: `linear-gradient(135deg, ${color}, ${color}88, ${color})`,
          filter: `url(#${filterId}) blur(4px)`,
          padding: thickness,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />

      {/* Soft outer halo */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: 'inherit',
          boxShadow: `0 0 32px ${color}55, 0 0 64px ${color}22`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}
