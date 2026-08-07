'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition, type TargetAndTransition } from 'framer-motion'

// Ma'lum interval'da matnlar orasida aylanuvchi so'z. Har harf/word
// alohida stagger bilan chiqadi va ketadi. React Bits variantiga
// yaqin -- pill-shaped, in-flow, o'lchov o'zgaruvchan.

interface RotatingTextProps {
  texts: string[]
  mainClassName?: string
  mainStyle?: React.CSSProperties
  splitLevelClassName?: string
  staggerFrom?: 'first' | 'last' | 'center'
  staggerDuration?: number
  rotationInterval?: number
  splitBy?: 'chars' | 'words'
  initial?: TargetAndTransition
  animate?: TargetAndTransition
  exit?: TargetAndTransition
  transition?: Transition
}

export default function RotatingText({
  texts,
  mainClassName,
  mainStyle,
  splitLevelClassName,
  staggerFrom = 'last',
  staggerDuration = 0.025,
  rotationInterval = 2500,
  splitBy = 'chars',
  initial = { y: '100%' },
  animate = { y: 0 },
  exit = { y: '-120%' },
  transition = { type: 'spring', damping: 30, stiffness: 400 },
}: RotatingTextProps) {
  const [index, setIndex] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const iv = setInterval(() => setIndex(i => (i + 1) % texts.length), rotationInterval)
    return () => clearInterval(iv)
  }, [texts.length, rotationInterval, reduce])

  const current = texts[index] ?? ''
  const units = splitBy === 'chars' ? Array.from(current) : current.split(/(\s+)/)

  const staggerFor = (i: number, total: number) => {
    if (staggerFrom === 'first') return i * staggerDuration
    if (staggerFrom === 'last')  return (total - 1 - i) * staggerDuration
    const c = (total - 1) / 2
    return Math.abs(c - i) * staggerDuration
  }

  return (
    <span className={mainClassName} style={{ display: 'inline-flex', ...mainStyle }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          className={splitLevelClassName}
          style={{ display: 'inline-flex' }}
        >
          {units.map((u, i) => (
            <motion.span
              key={i}
              initial={reduce ? undefined : initial}
              animate={reduce ? undefined : animate}
              exit={reduce ? undefined : exit}
              transition={{ ...transition, delay: staggerFor(i, units.length) }}
              style={{ display: 'inline-block', whiteSpace: 'pre' }}
            >
              {u === ' ' ? ' ' : u}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
