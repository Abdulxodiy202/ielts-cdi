'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface DeleteAccountModalProps {
  open: boolean
  onClose: () => void
}

// Hisobni butunlay o'chirish modali. cathoven.com'dagi "nega
// o'chiryapsiz" ekranidan ilhomlangan (lekin dizayni AYNAN nusxa emas --
// ilovaning o'z kartasi/tugma uslubida): sabab tanlash (majburiy) +
// ixtiyoriy izoh, so'ng ikki bosqichli tasdiqlash. Tanlangan sabab
// serverga (/api/account/delete) yuboriladi va account_deletions
// jadvaliga yoziladi -- admin panelda "kim, nima uchun ketgani" ko'rinishi
// uchun.
const REASON_KEYS = [
  'noLongerNeeded',
  'foundAlternative',
  'tooExpensive',
  'technicalIssues',
  'other',
] as const

export function DeleteAccountModal({ open, onClose }: DeleteAccountModalProps) {
  const { t } = useLanguage()
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    if (busy) return
    setStep('form')
    setReason('')
    setDetail('')
    setError(null)
    onClose()
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: t(`deleteAccount.reason_${reason}`), detail }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? t('deleteAccount.genericError'))
        setBusy(false)
        return
      }
      // Hisob endi mavjud emas -- mahalliy sessiyani ham tozalaymiz va
      // bosh sahifaga chiqaramiz.
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch {
      setError(t('deleteAccount.genericError'))
      setBusy(false)
    }
  }

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
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative card p-6 md:p-8 w-full max-w-md"
            style={{ zIndex: 51 }}
          >
            <button
              onClick={handleClose}
              disabled={busy}
              className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>

            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <AlertTriangle size={26} style={{ color: 'var(--error)' }} />
            </div>

            <h2 className="text-lg font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              {t('deleteAccount.modalTitle')}
            </h2>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t('deleteAccount.modalDesc')}
            </p>

            {step === 'form' ? (
              <>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('deleteAccount.reasonLabel')}
                </label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="input-field w-full mb-4"
                >
                  <option value="">{t('deleteAccount.reasonPlaceholder')}</option>
                  {REASON_KEYS.map(key => (
                    <option key={key} value={key}>{t(`deleteAccount.reason_${key}`)}</option>
                  ))}
                </select>

                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('deleteAccount.detailLabel')}
                </label>
                <textarea
                  value={detail}
                  onChange={e => setDetail(e.target.value)}
                  placeholder={t('deleteAccount.detailPlaceholder')}
                  className="input-field w-full resize-none mb-5"
                  rows={3}
                />

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={!reason}
                    onClick={() => setStep('confirm')}
                    className="btn-primary w-full font-bold disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                  >
                    {t('deleteAccount.continueButton')}
                  </button>
                  <button type="button" onClick={handleClose} className="btn-outline w-full text-sm">
                    {t('deleteAccount.cancelButton')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-5 font-semibold" style={{ color: 'var(--error)' }}>
                  {t('deleteAccount.finalWarning')}
                </p>

                {error && (
                  <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleDelete}
                    className="btn-primary w-full font-bold disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                  >
                    {busy ? t('deleteAccount.deleting') : t('deleteAccount.confirmButton')}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setStep('form')} className="btn-outline w-full text-sm disabled:opacity-40">
                    {t('deleteAccount.backButton')}
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
