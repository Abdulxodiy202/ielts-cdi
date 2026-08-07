'use client'

import { Clock } from 'lucide-react'
import { formatTime } from '@/lib/utils/formatters'

interface TestTimerProps {
  timeRemaining: number
}

export function TestTimer({ timeRemaining }: TestTimerProps) {
  const isWarning = timeRemaining <= 300  // last 5 minutes
  const isDanger = timeRemaining <= 60

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold"
      style={{
        background: isDanger
          ? 'rgba(239,68,68,0.15)'
          : isWarning
          ? 'rgba(245,158,11,0.15)'
          : 'var(--bg-card)',
        border: `1px solid ${isDanger ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--border)'}`,
        color: isDanger ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--text-primary)',
      }}
    >
      <Clock size={18} className={isDanger ? 'timer-warning' : ''} />
      <span className={isDanger ? 'timer-warning' : ''}>{formatTime(timeRemaining)}</span>
    </div>
  )
}
