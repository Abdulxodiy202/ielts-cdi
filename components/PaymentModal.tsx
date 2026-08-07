'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Copy,
  CheckCircle,
  Upload,
  Loader2,
  CreditCard,
  User,
  Phone,
  ImageIcon,
  Tag,
  ChevronDown,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils/formatters'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'premium' | 'mock_booking'
  amount: number
  meta?: { booking_date: string; time_slot: string; schedule_id?: string }
  initialName?: string
  initialPhone?: string
}

const CARD_NUMBER = '5614 6838 6058 6569'
const CARD_HOLDER = "MO'MINJONOV OTABEK"

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  type,
  amount,
  meta,
  initialName = '',
  initialPhone = '',
}: PaymentModalProps) {
  const { t } = useLanguage()
  const [fullName, setFullName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Referral code state
  const [referralInput, setReferralInput] = useState('')

  // Promo code state
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountPercent: number } | null>(null)

  const effectiveAmount = appliedPromo
    ? Math.round((amount * (1 - appliedPromo.discountPercent / 100)) / 1000) * 1000
    : amount

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CARD_NUMBER.replace(/\s/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    setPromoError('')
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput.trim() }),
      })
      const json = await res.json()
      if (json.valid) {
        setAppliedPromo({ code: promoInput.trim().toUpperCase(), discountPercent: json.discount_percent })
        setPromoError('')
      } else {
        setPromoError(json.error || t('payment.invalidPromo'))
        setAppliedPromo(null)
      }
    } catch {
      setPromoError(t('payment.networkError'))
    }
    setPromoLoading(false)
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(t('payment.imageOnlyError'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('payment.fileTooLargeError'))
      return
    }
    setError('')
    setReceipt(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSubmit = async () => {
    if (!fullName.trim()) { setError(t('payment.nameRequiredError')); return }
    if (!phone.trim()) { setError(t('payment.phoneRequiredError')); return }
    if (!receipt) { setError(t('payment.receiptRequiredError')); return }

    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('receipt', receipt)
    formData.append('user_name', fullName.trim())
    formData.append('user_phone', phone.trim())
    formData.append('type', type)
    formData.append('amount', String(effectiveAmount))
    if (meta) formData.append('meta', JSON.stringify(meta))
    if (appliedPromo) {
      formData.append('promo_code', appliedPromo.code)
      formData.append('original_amount', String(amount))
    }
    if (referralInput.trim()) {
      formData.append('referral_code', referralInput.trim().toUpperCase())
    }

    try {
      const res = await fetch('/api/payment', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || t('payment.genericError'))
        setLoading(false)
        return
      }
      setLoading(false)
      setDone(true)
      setTimeout(() => {
        onSuccess()
      }, 3000)
    } catch {
      setError(t('payment.networkErrorRetry'))
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setFullName(initialName)
    setPhone(initialPhone)
    setReceipt(null)
    setPreviewUrl(null)
    setError('')
    setDone(false)
    setPromoOpen(false)
    setPromoInput('')
    setPromoError('')
    setAppliedPromo(null)
    setReferralInput('')
    onClose()
  }

  const typeLabel = type === 'premium' ? t('payment.typePremium') : t('payment.typeMockBooking')

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto card p-6"
            style={{ zIndex: 51 }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>

            {done ? (
              /* Success state */
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
                  <CheckCircle
                    size={64}
                    className="mx-auto mb-4"
                    style={{ color: 'var(--success)' }}
                  />
                </motion.div>
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('payment.successTitle')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {type === 'premium' ? t('payment.successBodyPremium') : t('payment.successBodyBooking')}
                </p>
              </motion.div>
            ) : (
              <>
                {/* Header */}
                <div className="mb-5">
                  <h2
                    className="text-lg font-bold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {t('payment.title', { typeLabel })}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t('payment.instructions')}
                  </p>
                </div>

                {/* Card info box */}
                <div
                  className="rounded-xl p-4 mb-5"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={16} style={{ color: 'var(--accent)' }} />
                    <span
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t('payment.cardNumberLabel')}
                    </span>
                  </div>

                  {/* Card number with copy */}
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span
                      className="text-xl font-mono font-bold tracking-widest"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {CARD_NUMBER}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 p-2 rounded-lg transition-all"
                      style={{
                        background: copied
                          ? 'rgba(34,197,94,0.15)'
                          : 'var(--bg-card)',
                        color: copied ? 'var(--success)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}
                      title={t('payment.copyTitle')}
                    >
                      {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {CARD_HOLDER}
                  </p>

                  <div
                    className="mt-3 pt-3 flex items-center justify-between text-sm"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t('payment.transferAmount')}
                    </span>
                    <div className="flex items-center gap-2">
                      {appliedPromo && (
                        <span className="text-sm line-through" style={{ color: 'var(--text-muted)' }}>
                          {formatPrice(amount)}
                        </span>
                      )}
                      <span className="font-bold text-base" style={{ color: appliedPromo ? 'var(--success)' : 'var(--accent)' }}>
                        {formatPrice(effectiveAmount)}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Promo code — only for premium */}
                {type === 'premium' && (
                  <div className="mb-4">
                    {!appliedPromo ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPromoOpen(o => !o)}
                          className="flex items-center gap-1.5 text-xs font-medium mb-2 transition-opacity hover:opacity-70"
                          style={{ color: 'var(--accent)' }}
                        >
                          <Tag size={12} />
                          {t('payment.promoQuestion')}
                          <ChevronDown size={12} style={{ transform: promoOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                        {promoOpen && (
                          <div className="flex gap-2">
                            <input
                              className="input-field text-sm flex-1 uppercase"
                              placeholder={t('payment.promoPlaceholder')}
                              value={promoInput}
                              onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError('') }}
                              onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                              style={{ letterSpacing: '0.05em' }}
                            />
                            <button
                              type="button"
                              onClick={handleApplyPromo}
                              disabled={promoLoading || !promoInput.trim()}
                              className="btn-primary text-sm px-4 shrink-0 disabled:opacity-50"
                            >
                              {promoLoading ? <Loader2 size={13} className="animate-spin" /> : t('payment.promoApply')}
                            </button>
                          </div>
                        )}
                        {promoError && (
                          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--error)' }}>
                            ❌ {promoError}
                          </p>
                        )}
                      </>
                    ) : (
                      <div
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}
                      >
                        <span style={{ color: 'var(--success)' }}>
                          ✅ {t('payment.promoApplied', { code: appliedPromo.code, percent: appliedPromo.discountPercent })}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setAppliedPromo(null); setPromoInput(''); setPromoOpen(false) }}
                          className="ml-2 opacity-60 hover:opacity-100"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Referral code — premium only */}
                {type === 'premium' && (
                  <div className="mb-4">
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                      {t('payment.referralLabel')}
                    </label>
                    <div className="relative">
                      <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                      <input
                        className="input-field pl-9 text-sm uppercase"
                        placeholder={t('payment.referralPlaceholder')}
                        value={referralInput}
                        onChange={e => setReferralInput(e.target.value.toUpperCase())}
                        style={{ letterSpacing: '0.05em' }}
                      />
                    </div>
                  </div>
                )}

                {/* Inputs */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label
                      className="text-xs font-medium mb-1.5 block"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('payment.fullNameLabel')}
                    </label>
                    <div className="relative">
                      <User
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        className="input-field pl-9 text-sm"
                        placeholder={t('payment.fullNamePlaceholder')}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      className="text-xs font-medium mb-1.5 block"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('payment.phoneLabel')}
                    </label>
                    <div className="relative">
                      <Phone
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      />
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

                {/* Receipt upload */}
                <div className="mb-4">
                  <label
                    className="text-xs font-medium mb-1.5 block"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('payment.receiptLabel')}
                  </label>

                  {previewUrl ? (
                    <div className="relative rounded-xl overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Receipt preview"
                        className="w-full max-h-48 object-cover"
                      />
                      <button
                        onClick={() => {
                          setReceipt(null)
                          setPreviewUrl(null)
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl p-6 text-center cursor-pointer transition-all"
                      style={{
                        border: '2px dashed var(--border)',
                        background: 'var(--bg-secondary)',
                      }}
                    >
                      <ImageIcon
                        size={28}
                        className="mx-auto mb-2 opacity-40"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('payment.receiptUpload')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('payment.receiptInstructions')}
                      </p>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFile(file)
                    }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div
                    className="mb-4 p-3 rounded-lg text-sm"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      color: 'var(--error)',
                      border: '1px solid rgba(239,68,68,0.3)',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="btn-outline flex-1 text-sm"
                  >
                    {t('payment.cancelBtn')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="btn-primary flex-1 text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        {t('payment.submittingBtn')}
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        {t('payment.submitBtn')}
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
