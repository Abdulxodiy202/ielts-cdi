'use client'

import { useState, useEffect } from 'react'
import { PaymentModal } from '@/components/PaymentModal'

interface Props {
  open: boolean
  initialName?: string
  initialPhone?: string
}

export function DashboardPaymentOpener({ open, initialName = '', initialPhone = '' }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) setIsOpen(true)
  }, [open])

  if (success) return null

  return (
    <PaymentModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSuccess={() => { setIsOpen(false); setSuccess(true) }}
      type="premium"
      amount={50000}
      initialName={initialName}
      initialPhone={initialPhone}
    />
  )
}
