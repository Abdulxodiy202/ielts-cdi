'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, Crown } from 'lucide-react'

export interface ToastData {
  id: string
  message: string
  type: 'premium' | 'booking' | 'info'
}

interface ToastItemProps {
  toast: ToastData
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), 5000)
    return () => clearTimeout(t)
  }, [toast.id, onClose])

  const config = {
    premium: {
      bg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      shadow: '0 8px 32px rgba(245,158,11,0.4)',
      Icon: Crown,
    },
    booking: {
      bg: 'linear-gradient(135deg, #22c55e, #16a34a)',
      shadow: '0 8px 32px rgba(34,197,94,0.4)',
      Icon: CheckCircle,
    },
    info: {
      bg: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      shadow: '0 8px 32px rgba(99,102,241,0.4)',
      Icon: CheckCircle,
    },
  } as const

  const { bg, shadow, Icon } = config[toast.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 120, scale: 0.85 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 120, scale: 0.85 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      className="flex items-start gap-3 p-4 rounded-2xl text-white w-[320px]"
      style={{ background: bg, boxShadow: shadow }}
    >
      <Icon size={22} className="shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity ml-1"
      >
        <X size={16} />
      </button>
    </motion.div>
  )
}

interface ToastContainerProps {
  toasts: ToastData[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
