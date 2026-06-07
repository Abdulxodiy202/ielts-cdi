'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminClient } from './AdminClient'
import type { MockSchedule } from '@/components/admin/MockScheduleEditor'

const ADMIN_EMAIL = 'abdulxdiymamajonov@gmail.com'

interface Test {
  id: string
  type: string
  title: string
  order_number: number
  file_url: string | null
}

interface PaymentRequest {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_phone: string
  type: 'premium' | 'mock_booking'
  amount: number
  receipt_url: string
  status: 'pending' | 'approved' | 'rejected'
  meta: { booking_date?: string; time_slot?: string } | null
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauthorized'>('loading')
  const [payments, setPayments] = useState<PaymentRequest[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [schedules, setSchedules] = useState<MockSchedule[]>([])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { router.replace('/login'); return }
      if (user.email !== ADMIN_EMAIL) { router.replace('/dashboard'); return }

      // Fetch all admin data in parallel from API routes
      const [paymentsRes, testsRes, schedulesRes] = await Promise.all([
        fetch('/api/admin/payments'),
        fetch('/api/admin/tests'),
        fetch('/api/admin/mock-schedules'),
      ])

      setPayments(paymentsRes.ok ? await paymentsRes.json() : [])
      setTests(testsRes.ok ? await testsRes.json() : [])
      setSchedules(schedulesRes.ok ? await schedulesRes.json() : [])
      setStatus('ready')
    }

    init()
  }, [router])

  if (status === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminClient
      initialPayments={payments}
      tests={tests}
      initialSchedules={schedules}
    />
  )
}
