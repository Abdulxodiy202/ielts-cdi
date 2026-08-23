'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, Loader2, User, Phone, Send } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface FreeBookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  scheduleId: string
  initialName?: string
  initialPhone?: string
}

/**
 * Booking modal for schedules the admin marked free (price=0, migration
 * 037). Deliberately NOT a variant of PaymentModal -- no card info, no
 * receipt upload, no promo/referral fields, no admin-approval wait.
 * Just name + phone + submit, and /api/mock/free-book confirms the
 * booking immediately.
 */
export function FreeBookingModal({
  isOpen,
  onClose,
  onSuccess,
  scheduleId,
  initialName = '',
  initialPhone = '',
}: FreeBookingModalProps) {
  const { t } = useLanguage()
  const [fullName, setFullName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError(t('payment.nameRequiredError')); return }
    if (!phone.trim()) { setError(t('payment.phoneRequiredError')); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/mock/free-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, fullName: fullName.trim(), phone: phone.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        let localized: string
        if (json.error === 'session_full') localized = t('mockTest.fullMessage')
        else if (json.error === 'already_booked') localized = t('freeBooking.alreadyBookedError')
        else localized = json.message || t('payment.genericError')
        setError(localized)
        setLoading(false)
        return
      }
      setLoading(false)
      setDone(true)
      setTimeout(() => onSuccess(), 2000)
    } catch {
      setError(t('payment.networkErrorRetry'))
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setFullName(initialName)
    setPhone(initialPhone)
    setError('')
    setDone(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto card p-6"
            style={{ zIndex: 51 }}
          >
            <button
              onClick={handleClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>

            {done ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                >
                  <CheckCircle size={64} className="mx-auto mb-4" style={{ color: 'var(--success)' }} />
                </motion.div>
                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {t('freeBooking.successTitle')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {t('freeBooking.successBody')}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {t('freeBooking.title')}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t('freeBooking.subtitle')}
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                      {t('payment.fullNameLabel')}
                    </label>
                    <div className="relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                      <input
                        className="input-field pl-9 text-sm"
                        placeholder={t('payment.fullNamePlaceholder')}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                      {t('payment.phoneLabel')}
                    </label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                      <input
                        className="input-field pl-9 text-sm"
                        placeholder={t('payment.phonePlaceholder')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        type="tel"
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div
                    className="mb-4 p-3 rounded-lg text-sm"
                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleClose} disabled={loading} className="btn-outline flex-1 text-sm">
                    {t('payment.cancelBtn')}
                  </button>
                  <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 text-sm">
                    {loading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        {t('freeBooking.submittingBtn')}
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        {t('freeBooking.submitBtn')}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
