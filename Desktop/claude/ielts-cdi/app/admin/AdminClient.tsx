'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  ExternalLink, RefreshCw, User, Mail, Phone, Crown,
  Calendar, BookOpen, Headphones, CreditCard, BarChart2, Users,
} from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils/formatters'
import { TestFileUploader } from '@/components/admin/TestFileUploader'
import { MockScheduleEditor, type MockSchedule } from '@/components/admin/MockScheduleEditor'

interface TestResult {
  id: string
  user_id: string
  user_email: string
  user_name: string
  is_premium: boolean
  test_id: string
  test_title: string
  test_type: string
  score: number
  band: number
  time_taken: number | null
  completed_at: string
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

interface Test {
  id: string
  type: string
  title: string
  order_number: number
  file_url: string | null
}

interface AdminPaymentItem {
  id: string
  amount: number
  status: string
  type: string
  created_at: string
}

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  is_premium: boolean
  premium_until: string | null
  payment_count: number
  last_payment_date: string | null
  payments: AdminPaymentItem[]
  created_at: string
  last_sign_in_at: string | null
}

interface Props {
  initialPayments: PaymentRequest[]
  tests: Test[]
  initialSchedules: MockSchedule[]
  initialResults: TestResult[]
  initialUsers: AdminUser[]
}

/* ── Badges ──────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = {
    pending:  { label: 'Kutilmoqda', icon: <Clock size={12} />,       bg: 'rgba(245,158,11,0.15)',  color: 'var(--warning)', border: 'rgba(245,158,11,0.3)' },
    approved: { label: 'Tasdiqlandi', icon: <CheckCircle size={12} />, bg: 'rgba(34,197,94,0.15)',   color: 'var(--success)', border: 'rgba(34,197,94,0.3)' },
    rejected: { label: 'Rad etildi',  icon: <XCircle size={12} />,     bg: 'rgba(239,68,68,0.15)',   color: 'var(--error)',   border: 'rgba(239,68,68,0.3)' },
  }[status] ?? { label: status, icon: null, bg: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'var(--border)' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return type === 'premium' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--premium)', border: '1px solid rgba(245,158,11,0.3)' }}>
      <Crown size={11} /> Premium
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)' }}>
      <Calendar size={11} /> Mock Test
    </span>
  )
}

/* ── Payments tab ────────────────────────────────────────────────────── */
function PaymentsTab({ initialPayments }: { initialPayments: PaymentRequest[] }) {
  const [payments, setPayments] = useState(initialPayments)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)

  const pendingCount = payments.filter(p => p.status === 'pending').length
  const today = new Date().toDateString()
  const approvedToday = payments.filter(
    p => p.status === 'approved' && p.reviewed_at && new Date(p.reviewed_at).toDateString() === today
  ).length

  const refresh = async () => {
    setRefreshing(true)
    const res = await fetch('/api/admin/payments')
    if (res.ok) setPayments(await res.json())
    setRefreshing(false)
  }

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setLoading(prev => ({ ...prev, [id]: true }))
    const res = await fetch(`/api/admin/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_note: notes[id] || '' }),
    })
    if (res.ok) {
      setPayments(prev => prev.map(p => p.id === id
        ? { ...p, status: action === 'approve' ? 'approved' : 'rejected', reviewed_at: new Date().toISOString(), admin_note: notes[id] || null }
        : p
      ))
      setExpandedId(null)
    }
    setLoading(prev => ({ ...prev, [id]: false }))
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card p-4" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="text-3xl font-black" style={{ color: 'var(--warning)' }}>{pendingCount}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Kutilayotgan</div>
        </div>
        <div className="card p-4" style={{ border: '1px solid rgba(34,197,94,0.3)' }}>
          <div className="text-3xl font-black" style={{ color: 'var(--success)' }}>{approvedToday}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Bugun tasdiqlandi</div>
        </div>
        <div className="card p-4 hidden md:block">
          <div className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{payments.length}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Jami so&apos;rovlar</div>
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <button onClick={refresh} disabled={refreshing} className="btn-outline text-sm flex items-center gap-2">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      {/* List */}
      {payments.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Hali so&apos;rovlar yo&apos;q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(pr => {
            const isExpanded = expandedId === pr.id
            const isLoading = loading[pr.id]
            return (
              <div key={pr.id} className="card overflow-hidden"
                style={{ border: pr.status === 'pending' ? '1px solid rgba(245,158,11,0.2)' : '1px solid var(--border)' }}>
                <button className="w-full p-4 text-left" onClick={() => setExpandedId(isExpanded ? null : pr.id)}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{pr.user_name}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{pr.user_email}</div>
                      </div>
                      <TypeBadge type={pr.type} />
                      <StatusBadge status={pr.status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-sm" style={{ color: 'var(--accent)' }}>{formatPrice(pr.amount)}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(pr.created_at)}</div>
                      </div>
                      {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                      <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-secondary)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                              Foydalanuvchi ma&apos;lumotlari
                            </p>
                            {[
                              { Icon: User, val: pr.user_name },
                              { Icon: Mail, val: pr.user_email },
                              { Icon: Phone, val: pr.user_phone },
                            ].map(({ Icon, val }) => (
                              <div key={val} className="flex items-center gap-2 text-sm">
                                <Icon size={13} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>{val}</span>
                              </div>
                            ))}
                            {pr.meta?.booking_date && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {pr.meta.booking_date} · {pr.meta.time_slot === '09:00' ? '09:00 AM' : '01:00 PM'}
                                </span>
                              </div>
                            )}
                            {pr.admin_note && (
                              <div className="text-xs mt-2 p-2 rounded" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                📝 {pr.admin_note}
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Chek rasmi</p>
                            <a href={pr.receipt_url} target="_blank" rel="noopener noreferrer" className="block relative group rounded-xl overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={pr.receipt_url} alt="Receipt" className="w-full max-h-56 object-cover rounded-xl" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-xl flex items-center justify-center">
                                <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </a>
                          </div>
                        </div>

                        {pr.status === 'pending' && (
                          <div className="mt-4 space-y-3">
                            <textarea className="input-field text-sm resize-none" rows={2} placeholder="Admin izohi (ixtiyoriy)"
                              value={notes[pr.id] ?? ''} onChange={e => setNotes(prev => ({ ...prev, [pr.id]: e.target.value }))} />
                            <div className="flex gap-3">
                              <button onClick={() => handleAction(pr.id, 'approve')} disabled={isLoading}
                                className="btn-primary flex-1 text-sm" style={{ background: 'var(--success)' }}>
                                <CheckCircle size={14} />{isLoading ? 'Jarayonda...' : 'Tasdiqlash'}
                              </button>
                              <button onClick={() => handleAction(pr.id, 'reject')} disabled={isLoading}
                                className="btn-outline flex-1 text-sm" style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
                                <XCircle size={14} />{isLoading ? 'Jarayonda...' : 'Rad etish'}
                              </button>
                            </div>
                          </div>
                        )}
                        {pr.status !== 'pending' && pr.reviewed_at && (
                          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
                            Ko&apos;rib chiqilgan: {formatDate(pr.reviewed_at)}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Results tab ─────────────────────────────────────────────────────── */
function ResultsTab({ initialResults }: { initialResults: TestResult[] }) {
  const [results, setResults] = useState(initialResults)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'reading' | 'listening'>('reading')
  const [premiumFilter, setPremiumFilter] = useState<'all' | 'premium' | 'free'>('all')

  const refresh = async () => {
    setRefreshing(true)
    const res = await fetch('/api/admin/results')
    if (res.ok) setResults(await res.json())
    setRefreshing(false)
  }

  const bandColor = (band: number) => {
    if (band >= 8) return 'var(--success)'
    if (band >= 7) return '#3b82f6'
    if (band >= 6) return 'var(--warning)'
    if (band >= 5) return '#f97316'
    return 'var(--error)'
  }

  // Apply filters
  const filtered = results.filter(r => {
    const matchType = r.test_type === typeFilter
    const matchPremium =
      premiumFilter === 'all' ? true :
      premiumFilter === 'premium' ? r.is_premium :
      !r.is_premium
    return matchType && matchPremium
  })

  // Group by user_id
  const userMap = new Map<string, { user_id: string; user_name: string; user_email: string; is_premium: boolean; tests: TestResult[] }>()
  for (const r of filtered) {
    if (!userMap.has(r.user_id)) {
      userMap.set(r.user_id, {
        user_id: r.user_id,
        user_name: r.user_name,
        user_email: r.user_email,
        is_premium: r.is_premium,
        tests: [],
      })
    }
    userMap.get(r.user_id)!.tests.push(r)
  }
  const grouped = [...userMap.values()]

  // Avatar initials
  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-5">
      {/* ── Filters row 1: type ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {(['reading', 'listening'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setExpandedUserId(null) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: typeFilter === t ? 'var(--accent)' : 'transparent',
                color: typeFilter === t ? 'white' : 'var(--text-secondary)',
              }}
            >
              {t === 'reading' ? <BookOpen size={14} /> : <Headphones size={14} />}
              {t === 'reading' ? '📖 Reading' : '🎧 Listening'}
            </button>
          ))}
        </div>

        {/* ── Filters row 2: premium ── */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {([
            { key: 'all',     label: 'Barchasi' },
            { key: 'premium', label: '👑 Premium' },
            { key: 'free',    label: '👤 Oddiy' },
          ] as { key: 'all' | 'premium' | 'free'; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setPremiumFilter(key); setExpandedUserId(null) }}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: premiumFilter === key ? 'var(--accent)' : 'transparent',
                color: premiumFilter === key ? 'white' : 'var(--text-secondary)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <button onClick={refresh} disabled={refreshing} className="btn-outline text-sm flex items-center gap-2">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Yangilash
          </button>
        </div>
      </div>

      {/* Summary line */}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {grouped.length} ta foydalanuvchi · {filtered.length} ta natija
      </p>

      {/* ── Table ── */}
      {grouped.length === 0 ? (
        <div className="card p-12 text-center">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Natijalar yo&apos;q</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header */}
          <div
            className="grid px-4 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: '36px 1fr auto auto auto',
              gap: '12px',
              color: 'var(--text-muted)',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span />
            <span>Foydalanuvchi</span>
            <span className="text-right">Testlar</span>
            <span className="text-right">So&apos;ngi sana</span>
            <span />
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {grouped.map(ug => {
              const isExpanded = expandedUserId === ug.user_id
              const lastTest = ug.tests[0]
              return (
                <div key={ug.user_id}>
                  {/* User row */}
                  <button
                    className="w-full text-left px-4 py-3 transition-colors"
                    style={{ background: isExpanded ? 'var(--bg-secondary)' : undefined }}
                    onClick={() => setExpandedUserId(isExpanded ? null : ug.user_id)}
                  >
                    <div
                      className="grid items-center"
                      style={{ gridTemplateColumns: '36px 1fr auto auto auto', gap: '12px' }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: ug.is_premium ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
                          color: ug.is_premium ? 'var(--warning)' : 'var(--accent)',
                        }}
                      >
                        {initials(ug.user_name)}
                      </div>

                      {/* Name + email */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {ug.user_name}
                          </span>
                          {ug.is_premium && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                              style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }}
                            >
                              <Crown size={10} /> Premium
                            </span>
                          )}
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {ug.user_email}
                        </div>
                      </div>

                      {/* Test count */}
                      <div
                        className="text-sm font-bold text-right shrink-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        {ug.tests.length}
                      </div>

                      {/* Last date */}
                      <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {lastTest ? formatDate(lastTest.completed_at) : '—'}
                      </div>

                      {/* Chevron */}
                      <div className="shrink-0 flex justify-end">
                        {isExpanded
                          ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                          : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded: individual tests */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          className="border-t"
                          style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          {/* Sub-header */}
                          <div
                            className="grid px-6 py-2 text-xs font-semibold uppercase tracking-wide"
                            style={{
                              gridTemplateColumns: '1fr auto auto auto',
                              gap: '12px',
                              color: 'var(--text-muted)',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            <span>Test nomi</span>
                            <span className="text-right">Ball</span>
                            <span className="text-right">Band</span>
                            <span className="text-right">Sana</span>
                          </div>

                          {ug.tests.map(r => (
                            <div
                              key={r.id}
                              className="grid px-6 py-2.5 items-center border-b last:border-b-0"
                              style={{
                                gridTemplateColumns: '1fr auto auto auto',
                                gap: '12px',
                                borderColor: 'rgba(0,0,0,0.06)',
                              }}
                            >
                              <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                                {r.test_title}
                              </span>
                              <span className="text-sm font-bold text-right" style={{ color: 'var(--text-primary)' }}>
                                {r.score}/40
                              </span>
                              <span
                                className="text-sm font-bold text-right"
                                style={{ color: bandColor(r.band) }}
                              >
                                {r.band}
                              </span>
                              <span className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                                {formatDate(r.completed_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Users tab ───────────────────────────────────────────────────────── */
function UsersTab({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [subTab, setSubTab] = useState<'all' | 'premium' | 'free'>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null)
  const [setPassModal, setSetPassModal] = useState<{ userId: string; email: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [savingPass, setSavingPass] = useState(false)
  const [passSaved, setPassSaved] = useState(false)

  const handleSetPassword = async () => {
    if (!setPassModal || newPassword.length < 6) return
    setSavingPass(true)
    try {
      const res = await fetch(`/api/admin/users/${setPassModal.userId}/set-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      if (res.ok) {
        setPassSaved(true)
        setTimeout(() => {
          setSetPassModal(null)
          setNewPassword('')
          setPassSaved(false)
        }, 1500)
      } else {
        const json = await res.json()
        alert(json.error ?? 'Xatolik yuz berdi')
      }
    } finally {
      setSavingPass(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setRefreshing(false)
  }

  const togglePremium = async (userId: string, currentPremium: boolean) => {
    const newPremium = !currentPremium
    console.log('[togglePremium] ▶ called — userId:', userId, '| currentPremium:', currentPremium, '→ setting:', newPremium)
    setToggling(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch('/api/admin/set-premium', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, is_premium: newPremium }),
      })
      console.log('[togglePremium] response status:', res.status)
      const json = await res.json()
      console.log('[togglePremium] response body:', json)

      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_premium: json.is_premium } : u
        ))
      } else {
        console.error('[togglePremium] ✗ API error:', json)
        alert(`Xatolik: ${json.error ?? 'Noma\'lum xato'}`)
      }
    } catch (err) {
      console.error('[togglePremium] ✗ fetch exception:', err)
      alert('Serverga ulanishda xatolik yuz berdi')
    } finally {
      setToggling(prev => ({ ...prev, [userId]: false }))
    }
  }

  const initials = (name: string | null, email: string) => {
    if (name) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
      return name.slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
  }

  const filtered = users.filter(u => {
    const matchSub =
      subTab === 'all' ? true :
      subTab === 'premium' ? u.is_premium :
      !u.is_premium
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    return matchSub && matchSearch
  })

  const premiumCount = users.filter(u => u.is_premium).length
  const freeCount = users.filter(u => !u.is_premium).length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{users.length}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Jami foydalanuvchi</div>
        </div>
        <div className="card p-4" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="text-3xl font-black" style={{ color: 'var(--warning)' }}>{premiumCount}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Premium</div>
        </div>
        <div className="card p-4" style={{ border: '1px solid rgba(99,102,241,0.3)' }}>
          <div className="text-3xl font-black" style={{ color: 'var(--accent)' }}>{freeCount}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Oddiy</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Sub-tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {([
            { key: 'all',     label: 'Barchasi' },
            { key: 'premium', label: '👑 Premium' },
            { key: 'free',    label: '👤 Oddiy' },
          ] as { key: 'all' | 'premium' | 'free'; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: subTab === key ? 'var(--accent)' : 'transparent',
                color: subTab === key ? 'white' : 'var(--text-secondary)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Ism yoki email qidirish..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field text-sm flex-1 min-w-[180px]"
          style={{ maxWidth: 300 }}
        />

        {/* Refresh */}
        <div className="ml-auto">
          <button onClick={refresh} disabled={refreshing} className="btn-outline text-sm flex items-center gap-2">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Yangilash
          </button>
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {filtered.length} ta foydalanuvchi ko&apos;rsatilmoqda
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Foydalanuvchilar yo&apos;q</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header */}
          <div
            className="grid px-4 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: '28px 32px 1fr auto auto auto auto',
              gap: '10px',
              color: 'var(--text-muted)',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span>#</span>
            <span />
            <span>Foydalanuvchi</span>
            <span className="text-right">To&apos;lovlar</span>
            <span className="text-right">Qo&apos;shilgan</span>
            <span className="text-right">So&apos;ngi kirish</span>
            <span className="text-right">Amal</span>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map((u, idx) => {
              const isToggling = toggling[u.id]
              const paymentsExpanded = expandedPaymentId === u.id
              return (
                <div key={u.id}>
                  {/* Main row */}
                  <div
                    className="grid items-center px-4 py-3"
                    style={{ gridTemplateColumns: '28px 32px 1fr auto auto auto auto', gap: '10px' }}
                  >
                    {/* Row number */}
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {idx + 1}
                    </span>

                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: u.is_premium ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
                        color: u.is_premium ? 'var(--warning)' : 'var(--accent)',
                      }}
                    >
                      {initials(u.full_name, u.email)}
                    </div>

                    {/* Name + email */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {u.full_name ?? '—'}
                        </span>
                        {u.is_premium ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                            style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }}
                          >
                            <Crown size={10} /> Premium
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0"
                            style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}
                          >
                            <User size={10} /> Oddiy
                          </span>
                        )}
                      </div>
                      <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {u.email}
                      </div>
                    </div>

                    {/* Payment count badge */}
                    <div className="shrink-0 text-right">
                      {u.payment_count > 0 ? (
                        <button
                          onClick={() => setExpandedPaymentId(paymentsExpanded ? null : u.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                          style={{
                            background: paymentsExpanded ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                            color: 'var(--accent)',
                            border: '1px solid rgba(99,102,241,0.2)',
                          }}
                        >
                          💳 {u.payment_count} ta
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>

                    {/* Joined date */}
                    <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(u.created_at)}
                    </div>

                    {/* Last seen */}
                    <div className="text-xs text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : '—'}
                    </div>

                    {/* Toggle premium + reset password */}
                    <div className="shrink-0 flex items-center gap-2 justify-end">
                      <button
                        onClick={() => togglePremium(u.id, u.is_premium)}
                        disabled={isToggling}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50"
                        style={u.is_premium ? {
                          background: 'rgba(239,68,68,0.1)',
                          color: 'var(--error)',
                          border: '1px solid rgba(239,68,68,0.25)',
                        } : {
                          background: 'rgba(245,158,11,0.1)',
                          color: 'var(--warning)',
                          border: '1px solid rgba(245,158,11,0.25)',
                        }}
                      >
                        {isToggling ? '...' : u.is_premium ? 'Oddiyga o\'tkazish' : 'Premiumga o\'tkazish'}
                      </button>
                      <button
                        onClick={() => { setSetPassModal({ userId: u.id, email: u.email }); setNewPassword(''); setPassSaved(false) }}
                        title="Parol o'rnatish"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:opacity-80"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      >
                        🔑
                      </button>
                    </div>
                  </div>

                  {/* Expandable payment history */}
                  <AnimatePresence>
                    {paymentsExpanded && u.payments.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="px-4 pb-3 pt-1" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                            To&apos;lov tarixi
                          </p>
                          <div className="space-y-1.5">
                            {u.payments.map(p => (
                              <div key={p.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-2">
                                  <span style={{ color: 'var(--text-muted)' }}>{formatDate(p.created_at)}</span>
                                  <span className="px-1.5 py-0.5 rounded text-xs"
                                    style={{
                                      background: p.type === 'premium' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.08)',
                                      color: p.type === 'premium' ? 'var(--warning)' : 'var(--accent)',
                                    }}>
                                    {p.type === 'premium' ? '👑 Premium' : '📅 Mock Test'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {p.amount.toLocaleString()} so&apos;m
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      background: p.status === 'approved' ? 'rgba(34,197,94,0.12)' : p.status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                      color: p.status === 'approved' ? 'var(--success)' : p.status === 'rejected' ? 'var(--error)' : 'var(--warning)',
                                    }}>
                                    {p.status === 'approved' ? '✓ Tasdiqlandi' : p.status === 'rejected' ? '✗ Rad etildi' : '⏳ Kutilmoqda'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Set-password modal */}
      <AnimatePresence>
        {setPassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => { setSetPassModal(null); setNewPassword('') }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="relative card p-6 w-full max-w-sm"
              style={{ zIndex: 51 }}
            >
              <button
                onClick={() => { setSetPassModal(null); setNewPassword('') }}
                className="absolute top-4 right-4 p-1.5 rounded-lg"
                style={{ color: 'var(--text-muted)' }}
              >
                <XCircle size={18} />
              </button>

              <div className="text-2xl mb-3">🔑</div>
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                Parol o&apos;rnatish
              </h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                {setPassModal.email}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Yangi parol
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                    placeholder="Kamida 6 ta belgi"
                    className="input-field w-full font-mono"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleSetPassword}
                  disabled={savingPass || newPassword.length < 6}
                  className="btn-primary w-full font-semibold disabled:opacity-50"
                >
                  {passSaved ? '✅ Saqlandi!' : savingPass ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Tab definitions ─────────────────────────────────────────────────── */
const TABS = [
  { id: 'payments',  label: 'To\'lovlar',     Icon: CreditCard },
  { id: 'reading',   label: 'Reading Tests',  Icon: BookOpen },
  { id: 'listening', label: 'Listening Tests', Icon: Headphones },
  { id: 'mock',      label: 'Mock Test',       Icon: Calendar },
  { id: 'results',   label: 'Natijalar',       Icon: BarChart2 },
  { id: 'users',     label: 'Foydalanuvchilar', Icon: Users },
] as const
type TabId = typeof TABS[number]['id']

/* ── Main AdminClient ────────────────────────────────────────────────── */
export function AdminClient({ initialPayments, tests, initialSchedules, initialResults, initialUsers }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('payments')

  const pendingCount = initialPayments.filter(p => p.status === 'pending').length
  const readingTests = tests.filter(t => t.type === 'reading')
  const listeningTests = tests.filter(t => t.type === 'listening')

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Panel</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          To&apos;lovlar va test content boshqaruvi
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 mb-8 p-1 rounded-xl overflow-x-auto"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', width: 'fit-content', maxWidth: '100%' }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'white' : 'var(--text-secondary)',
              }}
            >
              <Icon size={15} />
              {label}
              {id === 'payments' && pendingCount > 0 && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full ml-0.5"
                  style={{
                    background: active ? 'rgba(255,255,255,0.25)' : 'rgba(245,158,11,0.2)',
                    color: active ? 'white' : 'var(--warning)',
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'payments' && <PaymentsTab initialPayments={initialPayments} />}
      {activeTab === 'reading' && (
        <TestFileUploader type="reading" tests={readingTests} accept=".pdf,.docx,.zip" />
      )}
      {activeTab === 'listening' && (
        <TestFileUploader type="listening" tests={listeningTests} accept=".mp3,.zip,.pdf" />
      )}
      {activeTab === 'mock' && (
        <MockScheduleEditor initialSchedules={initialSchedules} />
      )}
      {activeTab === 'results' && (
        <ResultsTab initialResults={initialResults} />
      )}
      {activeTab === 'users' && (
        <UsersTab initialUsers={initialUsers} />
      )}
    </div>
  )
}
