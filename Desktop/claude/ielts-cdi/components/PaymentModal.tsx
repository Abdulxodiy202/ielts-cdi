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
} from 'lucide-react'
import { formatPrice } from '@/lib/utils/formatters'

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

const CARD_NUMBER = '4916 9903 5400 1395'
const CARD_HOLDER = 'Abdulxodiy Mamajonov'

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
  const [fullName, setFullName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CARD_NUMBER.replace(/\s/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("Faqat rasm fayllari qabul qilinadi (jpg, png, webp)")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Fayl hajmi 10MB dan oshmasligi kerak")
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
    if (!fullName.trim()) { setError("Ism-sharif kiritilishi shart"); return }
    if (!phone.trim()) { setError("Telefon raqam kiritilishi shart"); return }
    if (!receipt) { setError("Chek rasmi yuklanishi shart"); return }

    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('receipt', receipt)
    formData.append('user_name', fullName.trim())
    formData.append('user_phone', phone.trim())
    formData.append('type', type)
    formData.append('amount', String(amount))
    if (meta) formData.append('meta', JSON.stringify(meta))

    try {
      const res = await fetch('/api/payment', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Xatolik yuz berdi")
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => {
        onSuccess()
      }, 3000)
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.")
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
    onClose()
  }

  const typeLabel = type === 'premium' ? 'Premium Obuna' : 'Mock Test'

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
                  To&apos;lov qabul qilindi! ✅
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  To&apos;lovingiz qabul qilindi! 24 soat ichida{' '}
                  {type === 'premium' ? 'premium faollashtiriladi' : 'bron tasdiqlanadi'}.
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
                    To&apos;lov — {typeLabel}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Kartaga o&apos;tkazma qiling, so&apos;ng chek rasmini yuboring
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
                      Karta raqami
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
                      title="Nusxa olish"
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
                      O&apos;tkazma summasi
                    </span>
                    <span
                      className="font-bold text-base"
                      style={{ color: 'var(--accent)' }}
                    >
                      {formatPrice(amount)}
                    </span>
                  </div>

                </div>

                {/* Inputs */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label
                      className="text-xs font-medium mb-1.5 block"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Ism-sharif
                    </label>
                    <div className="relative">
                      <User
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        className="input-field pl-9 text-sm"
                        placeholder="To'liq ism-sharifingiz"
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
                      Telefon raqam
                    </label>
                    <div className="relative">
                      <Phone
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                      />
                      <input
                        className="input-field pl-9 text-sm"
                        placeholder="+998 90 123 45 67"
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
                    Chek rasmi (screenshot)
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
                        Rasm yuklash
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Bosing yoki suring · JPG, PNG, WEBP · maks 10MB
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
                    Bekor qilish
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="btn-primary flex-1 text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Yuborilmoqda...
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        Yuborish
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
