'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

// Landing sahifadagi bo'limlar uchun scroll-triggered fade-in wrapper.
// `whileInView` bilan viewport'ga kirganda bir marta ochiladi.
// prefers-reduced-motion holatida animatsiyasiz render qiladi.

interface SectionRevealProps {
  children: ReactNode
  id?: string
  className?: string
  delay?: number
}

export function SectionReveal({ children, id, className, delay = 0 }: SectionRevealProps) {
  const reduce = useReducedMotion()
  if (reduce) {
    return (
      <section id={id} className={className}>
        {children}
      </section>
    )
  }
  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      viewport={{ once: true, margin: '-100px' }}
    >
      {children}
    </motion.section>
  )
}
