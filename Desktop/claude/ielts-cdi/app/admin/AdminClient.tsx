'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toggleUserPremium } from '@/app/actions/admin'
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  ExternalLink, RefreshCw, User, Mail, Phone, Crown,
  Calendar, BookOpen, Headphones, CreditCard, BarChart2, Users,
  Tag, Plus, Trash2, ToggleLeft, ToggleRight, Edit3, Copy, Send, MessageSquare,
  Loader2, Upload, FileText, X,
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
  initialPromoCodes: PromoCode[]
  promoDbMissing?: boolean
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
  const [msgModal, setMsgModal] = useState<{ userId: string; name: string } | null>(null)
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
  const [msgHistory, setMsgHistory] = useState<{ id: string; message: string; is_read: boolean; created_at: string }[]>([])
  const [msgHistoryLoading, setMsgHistoryLoading] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'premium' | 'free'>('all')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null)

  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return
    setBroadcasting(true)
    setBroadcastResult(null)
    try {
      const res = await fetch('/api/admin/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastText.trim(), target: broadcastTarget }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        const label = broadcastTarget === 'premium' ? 'Premium' : broadcastTarget === 'free' ? 'Oddiy' : ''
        setBroadcastResult(`✅ ${json.sent} ta ${label ? label + ' ' : ''}foydalanuvchiga yuborildi`)
        setBroadcastText('')
        setTimeout(() => { setBroadcastOpen(false); setBroadcastResult(null) }, 2500)
      } else {
        setBroadcastResult(`Xato: ${json.error ?? res.status}`)
      }
    } finally {
      setBroadcasting(false)
    }
  }

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

  const openMsgModal = async (userId: string, name: string) => {
    setMsgModal({ userId, name })
    setMsgText('')
    setMsgSent(false)
    setMsgHistory([])
    setMsgHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/messages')
      if (res.ok) {
        const all = await res.json()
        setMsgHistory(all.filter((m: { user_id: string }) => m.user_id === userId))
      }
    } finally {
      setMsgHistoryLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!msgModal || !msgText.trim()) return
    setSendingMsg(true)
    try {
      const res = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: msgModal.userId, message: msgText.trim() }),
      })
      if (res.ok) {
        setMsgSent(true)
        const sent = { id: Date.now().toString(), message: msgText.trim(), is_read: false, created_at: new Date().toISOString() }
        setMsgHistory(prev => [sent, ...prev])
        setTimeout(() => { setMsgSent(false); setMsgText('') }, 1500)
      } else {
        const json = await res.json()
        alert(json.error ?? 'Xatolik yuz berdi')
      }
    } finally {
      setSendingMsg(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setRefreshing(false)
  }

  const togglePremium = async (userId: string, currentPremium: boolean) => {
    setToggling(prev => ({ ...prev, [userId]: true }))
    try {
      const result = await toggleUserPremium(userId, !currentPremium)
      if (!result.ok) {
        alert('Xatolik: ' + result.error)
        return
      }
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_premium: !currentPremium } : u
      ))
    } catch (e) {
      alert('Kutilmagan xatolik: ' + (e instanceof Error ? e.message : String(e)))
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

        {/* Broadcast + Refresh */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setBroadcastOpen(true); setBroadcastText(''); setBroadcastResult(null); setBroadcastTarget('all') }}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Send size={14} /> Hammaga xabar
          </button>
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
                      <button
                        onClick={() => openMsgModal(u.id, u.full_name ?? u.email)}
                        title="Xabar yuborish"
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent)' }}
                      >
                        <Send size={14} />
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

      {/* Send message modal */}
      <AnimatePresence>
        {msgModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => { setMsgModal(null); setMsgText('') }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="relative card w-full max-w-md overflow-hidden"
              style={{ zIndex: 51 }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <Send size={15} style={{ color: 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Xabar yuborish</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{msgModal.name}</p>
                </div>
                <button onClick={() => { setMsgModal(null); setMsgText('') }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                  <XCircle size={17} />
                </button>
              </div>

              {/* Previous messages */}
              {(msgHistoryLoading || msgHistory.length > 0) && (
                <div className="border-b" style={{ borderColor: 'var(--border)', maxHeight: 180, overflowY: 'auto' }}>
                  <div className="px-5 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                    Oldingi xabarlar
                  </div>
                  {msgHistoryLoading ? (
                    <div className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Yuklanmoqda...</div>
                  ) : msgHistory.map(m => (
                    <div key={m.id} className="px-5 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(m.created_at).toLocaleString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={m.is_read ? { background: 'rgba(34,197,94,0.1)', color: 'var(--success)' } : { background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                          {m.is_read ? "O'qildi" : "O'qilmagan"}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{m.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Send form */}
              <div className="p-5 space-y-3">
                <textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Xabar matnini yozing..."
                  rows={3}
                  className="input-field w-full resize-none text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMsg || !msgText.trim()}
                  className="btn-primary w-full font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {msgSent ? '✅ Yuborildi!' : sendingMsg ? 'Yuborilmoqda...' : <><Send size={14} /> Yuborish</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Broadcast modal */}
      <AnimatePresence>
        {broadcastOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => { setBroadcastOpen(false); setBroadcastResult(null) }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="relative card w-full max-w-md overflow-hidden"
              style={{ zIndex: 51 }}
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <Send size={15} style={{ color: 'var(--warning)' }} />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Hammaga xabar yuborish</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Barcha foydalanuvchilarga bir vaqtda yuboriladi</p>
                </div>
                <button onClick={() => { setBroadcastOpen(false); setBroadcastResult(null) }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                  <XCircle size={17} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {/* Target selector */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Kimga yuborilsin:</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'all',     label: 'Hammaga' },
                      { key: 'premium', label: '👑 Premium' },
                      { key: 'free',    label: '👤 Oddiy' },
                    ] as { key: 'all' | 'premium' | 'free'; label: string }[]).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBroadcastTarget(key)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: broadcastTarget === key ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                          color: broadcastTarget === key ? 'var(--accent)' : 'var(--text-muted)',
                          border: broadcastTarget === key ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={broadcastText}
                  onChange={e => setBroadcastText(e.target.value)}
                  placeholder="Yuboriladigan xabar matnini yozing..."
                  rows={4}
                  className="input-field w-full resize-none text-sm"
                  autoFocus
                />
                {broadcastResult && (
                  <p className="text-sm font-medium" style={{ color: broadcastResult.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>
                    {broadcastResult}
                  </p>
                )}
                <button
                  onClick={handleBroadcast}
                  disabled={broadcasting || !broadcastText.trim()}
                  className="btn-primary w-full font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {broadcasting ? 'Yuborilmoqda...' : <><Send size={14} /> Hammaga yuborish</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Promo Codes tab ─────────────────────────────────────────────────── */
interface PromoUsage {
  id: string
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  original_amount: number | null
  discounted_amount: number | null
  used_at: string
}

interface PromoCode {
  id: string
  code: string
  discount_percent: number
  valid_from: string
  valid_until: string
  is_active: boolean
  created_at: string
  usage?: PromoUsage[]
}

const SETUP_SQL = `-- Run in Supabase SQL Editor → New query → Run
create table if not exists public.promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  discount_percent integer not null check (discount_percent between 1 and 100),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  is_active boolean default true not null,
  created_at timestamptz default now()
);
alter table public.promo_codes enable row level security;
create policy "Auth users can read active promo codes" on public.promo_codes
  for select using (auth.role() = 'authenticated');

create table if not exists public.promo_code_usage (
  id uuid default gen_random_uuid() primary key,
  promo_code_id uuid references public.promo_codes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  user_name text,
  user_email text,
  original_amount integer,
  discounted_amount integer,
  used_at timestamptz default now()
);
alter table public.promo_code_usage enable row level security;
create policy "Admin can view all usage" on public.promo_code_usage
  for select using (true);
create policy "Auth users can insert own usage" on public.promo_code_usage
  for insert with check (auth.uid() = user_id);

alter table public.payment_requests
  add column if not exists promo_code text,
  add column if not exists original_amount integer;`

function PromoCodesTab({ initialPromoCodes, dbMissing }: { initialPromoCodes: PromoCode[]; dbMissing?: boolean }) {
  const [codes, setCodes] = useState<PromoCode[]>(initialPromoCodes)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', discount_percent: 10, valid_from: '', valid_until: '' })
  const [expandedUsage, setExpandedUsage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const today = new Date().toISOString()

  const statusOf = (c: PromoCode) => {
    if (!c.is_active) return { label: 'O\'chirilgan', color: 'var(--text-muted)', bg: 'var(--bg-secondary)' }
    if (today > c.valid_until) return { label: 'Muddati o\'tgan', color: 'var(--error)', bg: 'rgba(239,68,68,0.1)' }
    if (today < c.valid_from) return { label: 'Hali boshlanmagan', color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)' }
    return { label: 'Faol', color: 'var(--success)', bg: 'rgba(34,197,94,0.1)' }
  }

  const resetForm = () => { setForm({ code: '', discount_percent: 10, valid_from: '', valid_until: '' }); setFormError(''); setEditingId(null) }

  const handleSave = async () => {
    setSaving(true); setFormError('')
    const method = editingId ? 'PATCH' : 'POST'
    const url = editingId ? `/api/admin/promo-codes/${editingId}` : '/api/admin/promo-codes'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const json = await res.json()
    if (!res.ok) { setFormError(json.error || 'Xatolik'); setSaving(false); return }
    if (editingId) {
      setCodes(prev => prev.map(c => c.id === editingId ? json : c))
    } else {
      setCodes(prev => [json, ...prev])
    }
    resetForm()
    setSaving(false)
  }

  const handleToggle = async (c: PromoCode) => {
    const res = await fetch(`/api/admin/promo-codes/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !c.is_active }),
    })
    if (res.ok) setCodes(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Promokodni o\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) setCodes(prev => prev.filter(c => c.id !== id))
  }

  const startEdit = (c: PromoCode) => {
    setEditingId(c.id)
    setForm({
      code: c.code,
      discount_percent: c.discount_percent,
      valid_from: c.valid_from.slice(0, 10),
      valid_until: c.valid_until.slice(0, 10),
    })
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('uz-UZ')

  const copySQL = () => {
    navigator.clipboard.writeText(SETUP_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="space-y-6">

      {/* DB setup banner */}
      {dbMissing && (
        <div className="card p-5" style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.05)' }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="text-2xl">⚠️</div>
            <div>
              <p className="font-bold text-sm mb-1" style={{ color: 'var(--warning)' }}>Jadval topilmadi</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <code>promo_codes</code> jadvali Supabase bazasida mavjud emas.
                Quyidagi SQL ni bir marta Supabase SQL Editor ga nusxalang va ishga tushiring.
              </p>
              <a
                href="https://supabase.com/dashboard/project/_/sql/new"
                target="_blank" rel="noopener noreferrer"
                className="text-xs underline mt-1 inline-block"
                style={{ color: 'var(--accent)' }}
              >
                Supabase SQL Editor →
              </a>
            </div>
          </div>
          <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', maxHeight: 260 }}>
            {SETUP_SQL}
          </pre>
          <button onClick={copySQL} className="btn-outline text-sm mt-3 flex items-center gap-2">
            {copied ? '✅ Nusxalandi!' : '📋 SQL ni nusxalash'}
          </button>
        </div>
      )}

      {/* Create / Edit form */}
      <div className="card p-5" style={{ border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          {editingId ? '✏️ Promokodni tahrirlash' : '➕ Yangi promokod'}
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Kod</label>
            <input
              className="input-field text-sm uppercase"
              placeholder="SUMMER20"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              style={{ letterSpacing: '0.05em' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Chegirma (%)</label>
            <input
              className="input-field text-sm"
              type="number"
              min={1}
              max={100}
              value={form.discount_percent}
              onChange={e => setForm(f => ({ ...f, discount_percent: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Boshlanish sanasi</label>
            <input
              className="input-field text-sm"
              type="date"
              value={form.valid_from}
              onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Tugash sanasi</label>
            <input
              className="input-field text-sm"
              type="date"
              value={form.valid_until}
              onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
            />
          </div>
        </div>
        {formError && (
          <p className="text-xs mb-3" style={{ color: 'var(--error)' }}>❌ {formError}</p>
        )}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
            <Plus size={14} /> {saving ? 'Saqlanmoqda...' : editingId ? 'Saqlash' : 'Qo\'shish'}
          </button>
          {editingId && (
            <button onClick={resetForm} className="btn-outline text-sm">Bekor qilish</button>
          )}
        </div>
      </div>

      {/* List */}
      {codes.length === 0 && !dbMissing ? (
        <div className="card p-12 text-center">
          <Tag size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Hali promokodlar yo&apos;q</p>
        </div>
      ) : codes.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="grid px-4 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{ gridTemplateColumns: '1fr 80px 1fr 1fr 80px 100px 90px', gap: 8, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            <span>Kod</span><span>Chegirma</span><span>Boshlanish</span><span>Tugash</span><span>Ishlatildi</span><span>Holat</span><span className="text-right">Amal</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {codes.map(c => {
              const st = statusOf(c)
              const usageList = c.usage ?? []
              const isUsageOpen = expandedUsage === c.id
              return (
                <div key={c.id}>
                  <div className="grid items-center px-4 py-3 text-sm"
                    style={{ gridTemplateColumns: '1fr 80px 1fr 1fr 80px 100px 90px', gap: 8 }}>
                    <span className="font-mono font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>{c.code}</span>
                    <span className="font-semibold" style={{ color: 'var(--accent)' }}>{c.discount_percent}%</span>
                    <span style={{ color: 'var(--text-muted)' }}>{fmtDate(c.valid_from)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{fmtDate(c.valid_until)}</span>
                    <button
                      onClick={() => setExpandedUsage(isUsageOpen ? null : c.id)}
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: usageList.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}
                    >
                      {usageList.length}x {usageList.length > 0 && (isUsageOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </button>
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => startEdit(c)} title="Tahrirlash"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => handleToggle(c)} title={c.is_active ? 'O\'chirish' : 'Yoqish'}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80"
                        style={{ background: c.is_active ? 'rgba(34,197,94,0.1)' : 'var(--bg-secondary)', border: '1px solid var(--border)', color: c.is_active ? 'var(--success)' : 'var(--text-muted)' }}>
                        {c.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                      </button>
                      <button onClick={() => handleDelete(c.id)} title="O'chirish"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:opacity-80"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--error)' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Usage expand */}
                  {isUsageOpen && usageList.length > 0 && (
                    <div className="px-4 pb-3" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wide py-2" style={{ color: 'var(--text-muted)' }}>Ishlatgan foydalanuvchilar</p>
                      <div className="space-y-1">
                        {usageList.map(u => (
                          <div key={u.id} className="text-xs py-2 px-3 rounded-lg space-y-1"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.user_name || 'Noma\'lum'}</span>
                                {u.user_email && <span style={{ color: 'var(--text-muted)' }}>{u.user_email}</span>}
                                {u.user_phone && <span style={{ color: 'var(--text-muted)' }}>{u.user_phone}</span>}
                              </div>
                              <div className="flex items-center gap-4 flex-wrap text-right">
                              {u.original_amount != null && (
                                <span style={{ color: 'var(--text-muted)' }}>
                                  <s>{formatPrice(u.original_amount)}</s> → <b style={{ color: 'var(--success)' }}>{formatPrice(u.discounted_amount ?? u.original_amount)}</b>
                                </span>
                              )}
                                <span style={{ color: 'var(--text-muted)' }}>{new Date(u.used_at).toLocaleString('uz-UZ')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── Referrals tab ───────────────────────────────────────────────────── */
interface ReferrerStat {
  id: string
  full_name: string | null
  email: string
  referral_code: string | null
  converted_count: number
}

function ReferralsTab() {
  const [stats, setStats] = useState<ReferrerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [dbMissing, setDbMissing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/referrals')
    if (res.status === 503) { setDbMissing(true); setLoading(false); return }
    if (res.ok) {
      const json = await res.json()
      setStats(json.stats ?? [])
    }
    setLoading(false)
  }

  const refresh = async () => {
    setRefreshing(true)
    const res = await fetch('/api/admin/referrals')
    if (res.ok) {
      const json = await res.json()
      setStats(json.stats ?? [])
    }
    setRefreshing(false)
  }

  const backfill = async () => {
    setBackfilling(true)
    setBackfillResult(null)
    const res = await fetch('/api/admin/referral/backfill', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      setBackfillResult(`${json.updated ?? 0} ta foydalanuvchiga kod berildi (${json.failed ?? 0} ta xato, jami ${json.total ?? 0} ta)`)
      await refresh()
    } else {
      setBackfillResult(`Xato: ${json.error ?? res.status}`)
    }
    setBackfilling(false)
  }

  useEffect(() => { load() }, [])

  if (dbMissing) {
    return (
      <div className="card p-6 space-y-4" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: 'var(--warning)' }} />
          <h3 className="font-bold" style={{ color: 'var(--warning)' }}>Jadval topilmadi — Referral tizimi</h3>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Supabase SQL Editor da migration faylini ishga tushiring.</p>
        <button onClick={load} className="btn-primary text-sm">Qayta urinish</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={backfill} disabled={backfilling} className="btn-primary text-sm flex items-center gap-2">
          {backfilling ? <RefreshCw size={14} className="animate-spin" /> : <Users size={14} />}
          Eski userlar uchun kod generatsiya qilish
        </button>
        {backfillResult && <span className="text-sm" style={{ color: 'var(--success)' }}>{backfillResult}</span>}
        <button onClick={refresh} disabled={refreshing} className="btn-outline text-sm flex items-center gap-2 ml-auto">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="grid px-4 py-3 text-xs font-semibold uppercase tracking-wide"
          style={{ gridTemplateColumns: '1fr 1fr 160px 100px', gap: 8, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <span>Ism</span>
          <span>Email</span>
          <span>Referral kodi</span>
          <span className="text-center">Premium olganlar</span>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {stats.length === 0 ? (
            <div className="p-12 text-center">
              <p style={{ color: 'var(--text-muted)' }}>Foydalanuvchilar topilmadi</p>
            </div>
          ) : stats.map(u => (
            <div key={u.id} className="grid items-center px-4 py-3 text-sm"
              style={{ gridTemplateColumns: '1fr 1fr 160px 100px', gap: 8 }}>
              <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.full_name ?? '—'}</span>
              <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</span>
              <span className="font-mono font-bold" style={{ color: u.referral_code ? 'var(--accent)' : 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {u.referral_code ?? '—'}
              </span>
              <span className="text-center font-bold" style={{ color: u.converted_count > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                {u.converted_count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Feedback tab ────────────────────────────────────────────────────── */
interface FeedbackItem {
  id: string
  user_id: string
  user_name: string | null
  user_email: string
  message: string
  status: string
  created_at: string
}

/* ── Articles Tab ────────────────────────────────────────────────────── */
interface ArticleItem {
  id: string
  title: string
  file_url: string | null
  cover_image_url: string | null
  is_premium: boolean
  is_published: boolean
  created_at: string
}


function ArticlesTab() {
  const [articles, setArticles]           = useState<ArticleItem[]>([])
  const [loading, setLoading]             = useState(true)
  const [selectedId, setSelectedId]       = useState('')
  const [selectedFile, setSelectedFile]   = useState<File | null>(null)
  const [saving, setSaving]               = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage]             = useState<{ ok: boolean; text: string } | null>(null)
  const [uploadedUrls, setUploadedUrls]   = useState<Record<string, string | null>>({})
  const [showCreate, setShowCreate]       = useState(false)
  const [newTitle, setNewTitle]           = useState('')
  const [creating, setCreating]           = useState(false)
  const [togglingPremium, setTogglingPremium] = useState(false)
  const [editTitle, setEditTitle]             = useState('')
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null)
  const [savingCover, setSavingCover]             = useState(false)
  const [coverUrls, setCoverUrls]                 = useState<Record<string, string | null>>({})
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/articles')
      .then(async r => { const d = await r.json().catch(() => []); if (Array.isArray(d)) setArticles(d) })
      .finally(() => setLoading(false))
  }, [])

  const selectedArticle = articles.find(a => a.id === selectedId) ?? null
  const currentUrl = selectedId in uploadedUrls ? uploadedUrls[selectedId] : (selectedArticle?.file_url ?? null)
  const currentFileName = currentUrl ? decodeURIComponent(currentUrl.split('/').pop()?.split('?')[0] ?? '') : null

  function handleArticleChange(id: string) {
    setSelectedId(id)
    setEditTitle(articles.find(a => a.id === id)?.title ?? '')
    setSelectedFile(null); setSelectedCoverFile(null)
    setMessage(null); setShowDeleteConfirm(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  async function handleSave() {
    if (!selectedId) return
    const trimmedTitle = editTitle.trim()
    const titleChanged = trimmedTitle && trimmedTitle !== selectedArticle?.title
    if (!titleChanged && !selectedFile) return
    setSaving(true); setMessage(null)
    try {
      if (titleChanged) {
        const res = await fetch(`/api/articles/${selectedId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmedTitle }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Nom saqlashda xato') }
        setArticles(prev => prev.map(a => a.id === selectedId ? { ...a, title: trimmedTitle } : a))
      }

      if (selectedFile) {
        const urlRes = await fetch('/api/admin/article-upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: selectedId, fileName: selectedFile.name }),
        })
        if (!urlRes.ok) { const e = await urlRes.json().catch(() => ({})); throw new Error(e.error ?? 'URL olishda xato') }
        const { signedUrl, contentType, publicUrl } = await urlRes.json()

        const uploadRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: selectedFile })
        if (!uploadRes.ok) { const t = await uploadRes.text().catch(() => ''); throw new Error(`Storage xatosi ${uploadRes.status}${t ? ': '+t.slice(0,120) : ''}`) }

        const recordRes = await fetch('/api/admin/article-record', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleId: selectedId, publicUrl }),
        })
        if (!recordRes.ok) { const e = await recordRes.json().catch(() => ({})); throw new Error(e.error ?? 'DB xato') }

        const { url } = await recordRes.json()
        setUploadedUrls(prev => ({ ...prev, [selectedId]: url }))
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }

      setMessage({ ok: true, text: 'Saqlandi!' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Xatolik yuz berdi' })
    } finally { setSaving(false) }
  }

  async function handleDeleteFile() {
    if (!selectedId || !currentFileName) return
    setDeleting(true); setMessage(null)
    try {
      const res = await fetch('/api/admin/article-delete', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: selectedId, fileName: currentFileName }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "O'chirish xatosi") }
      setUploadedUrls(prev => ({ ...prev, [selectedId]: null }))
      setShowDeleteConfirm(false)
      setMessage({ ok: true, text: "Fayl o'chirildi!" })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Xatolik yuz berdi' })
    } finally { setDeleting(false) }
  }

  async function handleTogglePremium() {
    if (!selectedArticle) return
    setTogglingPremium(true)
    try {
      const res = await fetch(`/api/articles/${selectedId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_premium: !selectedArticle.is_premium }),
      })
      if (res.ok) setArticles(prev => prev.map(a => a.id === selectedId ? { ...a, is_premium: !a.is_premium } : a))
    } finally { setTogglingPremium(false) }
  }

  async function handleSaveCover() {
    if (!selectedId || !selectedCoverFile) return
    setSavingCover(true); setMessage(null)
    try {
      const urlRes = await fetch('/api/admin/article-cover-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: selectedId, fileName: selectedCoverFile.name }),
      })
      if (!urlRes.ok) { const e = await urlRes.json().catch(() => ({})); throw new Error(e.error ?? 'URL olishda xato') }
      const { signedUrl, contentType, publicUrl } = await urlRes.json()

      const uploadRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: selectedCoverFile })
      if (!uploadRes.ok) { const t = await uploadRes.text().catch(() => ''); throw new Error(`Storage xatosi ${uploadRes.status}${t ? ': '+t.slice(0,80) : ''}`) }

      const patchRes = await fetch(`/api/articles/${selectedId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_url: publicUrl }),
      })
      if (!patchRes.ok) { const e = await patchRes.json().catch(() => ({})); throw new Error(e.error ?? 'DB xato') }

      setCoverUrls(prev => ({ ...prev, [selectedId]: publicUrl }))
      setArticles(prev => prev.map(a => a.id === selectedId ? { ...a, cover_image_url: publicUrl } : a))
      setSelectedCoverFile(null)
      if (coverInputRef.current) coverInputRef.current.value = ''
      setMessage({ ok: true, text: 'Muqova rasmi saqlandi!' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Xatolik yuz berdi' })
    } finally { setSavingCover(false) }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/articles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      if (res.ok) {
        const created = await res.json()
        setArticles(prev => [created, ...prev])
        setSelectedId(created.id)
        setShowCreate(false); setNewTitle(''); setMessage(null)
        setSelectedFile(null); setShowDeleteConfirm(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } finally { setCreating(false) }
  }

  if (loading) return (
    <div className="flex justify-center p-12">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{articles.length} ta maqola</span>
        <button onClick={() => { setShowCreate(true); setNewTitle('') }}
          className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Yangi maqola
        </button>
      </div>

      <div className="card p-4">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Maqola tanlang</label>
        <select value={selectedId} onChange={e => handleArticleChange(e.target.value)} className="input-field">
          <option value="">— Maqola tanlang —</option>
          {articles.map(a => (
            <option key={a.id} value={a.id}>{a.title}{!a.is_published ? ' (Draft)' : ''}</option>
          ))}
        </select>
      </div>

      {selectedId && (
        <div className="card p-5 space-y-4">
          {/* Title input */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Sarlavha
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="input-field w-full text-sm"
              placeholder="Maqola sarlavhasi..."
            />
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* is_premium toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Premium holati</span>
            <button
              onClick={handleTogglePremium}
              disabled={togglingPremium}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={selectedArticle?.is_premium ? {
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)',
              } : {
                background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)',
              }}
            >
              {selectedArticle?.is_premium ? <Crown size={13} /> : <ToggleLeft size={13} />}
              {togglingPremium ? '...' : selectedArticle?.is_premium ? 'Premium' : 'Bepul'}
            </button>
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* Cover image */}
          {(() => {
            const currentCover = selectedId in coverUrls ? coverUrls[selectedId] : (selectedArticle?.cover_image_url ?? null)
            return (
              <div className="space-y-2">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Muqova rasmi</p>
                {currentCover && !selectedCoverFile && (
                  <div className="rounded-xl overflow-hidden" style={{ height: 100, border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentCover} alt="cover" className="w-full h-full object-cover" />
                  </div>
                )}
                <div
                  className="relative flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                  style={{
                    border: `2px dashed ${selectedCoverFile ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedCoverFile ? 'rgba(99,102,241,0.05)' : 'var(--bg-secondary)',
                  }}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {selectedCoverFile ? (
                    <>
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0"
                        style={{ border: '1px solid var(--border)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(selectedCoverFile)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{selectedCoverFile.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(selectedCoverFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setSelectedCoverFile(null); if (coverInputRef.current) coverInputRef.current.value = '' }}
                        className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 py-1">
                      <Upload size={16} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {currentCover ? 'Rasmni almashtirish...' : 'JPG, PNG, WebP yuklash'}
                      </span>
                    </div>
                  )}
                  <input ref={coverInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden"
                    onChange={e => setSelectedCoverFile(e.target.files?.[0] ?? null)} />
                </div>
                {selectedCoverFile && (
                  <button onClick={handleSaveCover} disabled={savingCover}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    style={{ opacity: savingCover ? 0.6 : 1 }}>
                    {savingCover ? <><Loader2 size={14} className="animate-spin" /> Yuklanmoqda…</> : <><Upload size={14} /> Rasmni saqlash</>}
                  </button>
                )}
              </div>
            )
          })()}

          <hr style={{ borderColor: 'var(--border)' }} />

          {/* Current file */}
          {currentFileName && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Joriy fayl:</p>
                  <a href={currentUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                    className="text-sm truncate block hover:underline" style={{ color: 'var(--success)' }}>
                    {currentFileName}
                  </a>
                </div>
                <button type="button"
                  onClick={() => { setShowDeleteConfirm(true); setMessage(null) }}
                  disabled={deleting}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium shrink-0"
                  style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Trash2 size={13} /><span>O&apos;chirish</span>
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>Haqiqatan ham o&apos;chirilsinmi?</p>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      Bekor
                    </button>
                    <button type="button" onClick={handleDeleteFile} disabled={deleting}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--error)', color: '#fff', opacity: deleting ? 0.7 : 1 }}>
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {deleting ? "O'chirilmoqda…" : "Ha, o'chirish"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File picker */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              {currentFileName ? 'Yangi fayl bilan almashtirish:' : 'Fayl yuklash:'}
            </p>
            <div
              className="relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl cursor-pointer"
              style={{
                border: `2px dashed ${selectedFile ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedFile ? 'rgba(99,102,241,0.05)' : 'var(--bg-secondary)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <>
                  <FileText size={28} style={{ color: 'var(--accent)' }} />
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedFile.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="absolute top-2 right-2 p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <Upload size={22} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Maqola faylini yuklash</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PDF, HTML qabul qilinadi</p>
                  </div>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.html,.htm" className="hidden"
                onChange={e => { setSelectedFile(e.target.files?.[0] ?? null); setMessage(null) }} />
            </div>
          </div>

          {message && (
            <div className="p-3 rounded-xl text-sm font-medium"
              style={{
                background: message.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: message.ok ? 'var(--success)' : 'var(--error)',
                border: `1px solid ${message.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              {message.ok ? '✅' : '❌'} {message.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || (!selectedFile && (!editTitle.trim() || editTitle.trim() === selectedArticle?.title))}
            className="btn-primary w-full flex items-center justify-center gap-2"
            style={{
              opacity: saving || (!selectedFile && (!editTitle.trim() || editTitle.trim() === selectedArticle?.title)) ? 0.5 : 1,
              cursor: saving || (!selectedFile && (!editTitle.trim() || editTitle.trim() === selectedArticle?.title)) ? 'not-allowed' : 'pointer',
            }}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saqlanmoqda…</> : <><Upload size={16} /> Saqlash</>}
          </button>
        </div>
      )}

      {!selectedId && (
        <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
          Yuqoridan maqola tanlang
        </div>
      )}

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowCreate(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="relative card p-6 w-full max-w-sm space-y-4"
              style={{ zIndex: 51 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Yangi maqola</h3>
                <button onClick={() => setShowCreate(false)} style={{ color: 'var(--text-muted)' }}>
                  <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Maqola sarlavhasi
                </label>
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Sarlavha..." className="input-field w-full text-sm" autoFocus />
              </div>
              <button onClick={handleCreate} disabled={creating || !newTitle.trim()}
                className="btn-primary w-full text-sm disabled:opacity-50">
                {creating ? 'Yaratilyapti...' : 'Yaratish'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FeedbackTab() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dbMissing, setDbMissing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [replyModal, setReplyModal] = useState<FeedbackItem | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [replySent, setReplySent] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/feedback')
    if (res.status === 503) { setDbMissing(true); setLoading(false); return }
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  const refresh = async () => {
    setRefreshing(true)
    const res = await fetch('/api/admin/feedback')
    if (res.ok) setItems(await res.json())
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const openReply = (item: FeedbackItem) => {
    setReplyModal(item)
    setReplyText('')
    setReplySent(false)
  }

  const handleSendReply = async () => {
    if (!replyModal || !replyText.trim()) return
    setSending(true)
    try {
      const msgRes = await fetch('/api/admin/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: replyModal.user_id, message: replyText.trim() }),
      })
      if (!msgRes.ok) {
        const json = await msgRes.json().catch(() => ({}))
        alert(json.error ?? 'Xatolik yuz berdi')
        setSending(false)
        return
      }
      await fetch(`/api/admin/feedback/${replyModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'replied' }),
      })
      setItems(prev => prev.map(f => f.id === replyModal.id ? { ...f, status: 'replied' } : f))
      setReplySent(true)
      setTimeout(() => { setReplyModal(null); setReplySent(false) }, 1500)
    } finally {
      setSending(false)
    }
  }

  if (dbMissing) {
    return (
      <div className="card p-6 space-y-3" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
        <p className="font-bold text-sm" style={{ color: 'var(--warning)' }}>⚠️ feedback jadvali topilmadi</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Supabase SQL Editor da migration ni ishga tushiring, keyin sahifani yangilang.
        </p>
        <button onClick={load} className="btn-primary text-sm">Qayta urinish</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {items.length} ta feedback · {items.filter(f => f.status === 'new').length} ta yangi
        </p>
        <button onClick={refresh} disabled={refreshing} className="btn-outline text-sm flex items-center gap-2">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Hali feedback yo&apos;q</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div
            className="grid px-4 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: '1fr 2fr auto auto',
              gap: '12px',
              color: 'var(--text-muted)',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span>Foydalanuvchi</span>
            <span>Xabar</span>
            <span>Vaqt</span>
            <span className="text-right">Amal</span>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {items.map(item => (
              <div
                key={item.id}
                className="grid items-start px-4 py-3"
                style={{ gridTemplateColumns: '1fr 2fr auto auto', gap: '12px' }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.user_name ?? '—'}
                  </div>
                  <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {item.user_email}
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.message}
                </p>
                <div className="shrink-0">
                  <div className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {fmtTime(item.created_at)}
                  </div>
                  <span
                    className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={item.status === 'replied'
                      ? { background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }
                      : { background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}
                  >
                    {item.status === 'replied' ? '✓ Javob berilgan' : '● Yangi'}
                  </span>
                </div>
                <div className="shrink-0">
                  <button
                    onClick={() => openReply(item)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                    style={{
                      background: item.status === 'replied' ? 'var(--bg-secondary)' : 'rgba(99,102,241,0.1)',
                      color: item.status === 'replied' ? 'var(--text-muted)' : 'var(--accent)',
                      border: item.status === 'replied' ? '1px solid var(--border)' : '1px solid rgba(99,102,241,0.25)',
                    }}
                  >
                    {item.status === 'replied' ? 'Qayta javob' : 'Javob berish'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reply modal */}
      <AnimatePresence>
        {replyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setReplyModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="relative card w-full max-w-md overflow-hidden"
              style={{ zIndex: 51 }}
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <Send size={15} style={{ color: 'var(--accent)' }} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Feedback'ga javob</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {replyModal.user_name ?? replyModal.user_email}
                  </p>
                </div>
                <button onClick={() => setReplyModal(null)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                  <XCircle size={17} />
                </button>
              </div>

              {/* Original feedback */}
              <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Foydalanuvchi yozgani
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {replyModal.message}
                </p>
              </div>

              <div className="p-5 space-y-3">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Javob matnini yozing..."
                  rows={4}
                  className="input-field w-full resize-none text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                  className="btn-primary w-full font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {replySent ? '✅ Yuborildi!' : sending ? 'Yuborilmoqda...' : <><Send size={14} /> Yuborish</>}
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
  { id: 'payments',  label: 'To\'lovlar',      Icon: CreditCard },
  { id: 'reading',   label: 'Reading Tests',   Icon: BookOpen },
  { id: 'listening', label: 'Listening Tests',  Icon: Headphones },
  { id: 'mock',      label: 'Mock Test',        Icon: Calendar },
  { id: 'results',   label: 'Natijalar',        Icon: BarChart2 },
  { id: 'users',     label: 'Foydalanuvchilar', Icon: Users },
  { id: 'promo',     label: 'Promo kodlar',     Icon: Tag },
  { id: 'referrals', label: 'Referrallar',      Icon: Users },
  { id: 'articles',  label: 'Maqolalar',         Icon: BookOpen },
  { id: 'feedback',  label: 'Feedback',         Icon: MessageSquare },
] as const
type TabId = typeof TABS[number]['id']

/* ── Main AdminClient ────────────────────────────────────────────────── */
export function AdminClient({ initialPayments, tests, initialSchedules, initialResults, initialUsers, initialPromoCodes, promoDbMissing }: Props) {
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
      {activeTab === 'promo' && (
        <PromoCodesTab initialPromoCodes={initialPromoCodes} dbMissing={promoDbMissing} />
      )}
      {activeTab === 'referrals' && <ReferralsTab />}
      {activeTab === 'articles' && <ArticlesTab />}
      {activeTab === 'feedback' && <FeedbackTab />}
    </div>
  )
}
