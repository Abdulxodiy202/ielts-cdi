'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen, Headphones, Gamepad2, Keyboard, PenLine, Star } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

// Features grid. MUHIM: Icon component'lar bu client komponent
// ichida import qilinadi -- server komponentdan (app/page.tsx) client'ga
// component reference prop qilib uzatilsa RSC xato beradi ("Server
// Components render" digest'i production'da). Shuning uchun massiv shu
// yerda joylashadi.

interface Feature {
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>
  title: string
  color: string
  desc: string
}

const FEATURES: Feature[] = [
  { icon: BookOpen,  title: 'Reading Tests',       color: '#6366f1', desc: '35 academic passages with 40 questions each. Instant scoring, band prediction, and full answer review after every attempt.' },
  { icon: Headphones,title: 'Listening Tests',     color: '#ec4899', desc: '35 audio tests plus section-by-section training. Real exam conditions with authentic accents.' },
  { icon: Gamepad2,  title: 'Vocabulary Games',    color: '#22c55e', desc: '100 levels of interactive word puzzles. Build 3000+ IELTS words through play, not memorization.' },
  { icon: Keyboard,  title: 'Typing Practice',     color: '#a855f7', desc: "Monkeytype-style speed training with IELTS vocabulary and full Task 1 / Task 2 essays." },
  { icon: PenLine,   title: 'Script Practice',     color: '#06b6d4', desc: 'BBC 6-Minute English dictation. Type what you hear -- the app grades word by word.' },
  { icon: Star,      title: 'Star Progress System',color: '#f59e0b', desc: 'Every completed test earns stars. Track progress across Reading, Listening, Articles, Videos, and Script Practice.' },
]

export function FeaturesGrid() {
  const reduce = useReducedMotion()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {FEATURES.map((f, index) => {
        const Icon = f.icon
        return (
          <motion.div
            key={f.title}
            initial={reduce ? undefined : { opacity: 0, y: 20 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.5, ease: 'easeOut' }}
            viewport={{ once: true, margin: '-60px' }}
            whileHover={reduce ? undefined : { rotateY: 5, scale: 1.02, transition: { duration: 0.25 } }}
            className="card p-6 transition-shadow duration-300"
            style={{
              borderRadius: 16,
              minHeight: 220,
              transformStyle: 'preserve-3d',
              perspective: 1000,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = `0 0 40px ${f.color}40`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = ''
            }}
          >
            <motion.div
              whileHover={reduce ? undefined : { scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: `${f.color}20`, border: `1px solid ${f.color}40` }}
            >
              <Icon width={26} height={26} style={{ color: f.color }} />
            </motion.div>
            <h3 className="font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {f.desc}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}
