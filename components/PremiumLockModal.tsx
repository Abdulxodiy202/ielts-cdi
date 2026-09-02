'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Crown, X } from 'lucide-react'

interface PremiumLockModalProps {
  open: boolean
  onClose: () => void
  onUpgrade: () => void
  title: string
  description: string
  cancelLabel: string
  upgradeLabel: string
}

// Butun ilova bo'yicha YAGONA premium-qulf modali. Reading/Listening test
// ro'yxatidagi original dizayn -- kichik markazlashgan karta, orqa fonda
// qorong'i overlay, hech qanday sahifa almashtirish yo'q. Foydalanuvchi
// qayerda premium kontentga tegmasin (Script, Article, AI Study Plan,
// va h.k.) AYNAN shu bitta ko'rinish chiqishi kerak -- alohida "to'liq
// sahifa" qulf ekranlari yoki /premium'ga sakrash endi ishlatilmaydi.
export function PremiumLockModal({
  open, onClose, onUpgrade, title, description, cancelLabel, upgradeLabel,
}: PremiumLockModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative card p-8 w-full max-w-sm text-center"
            style={{ zIndex: 51 }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <Lock size={28} style={{ color: 'var(--premium)' }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {description}
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onUpgrade}
                className="btn-primary w-full font-bold"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  boxShadow: '0 0 16px rgba(245,158,11,0.35)',
                }}
              >
                <Crown size={16} /> {upgradeLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-outline w-full text-sm"
              >
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
