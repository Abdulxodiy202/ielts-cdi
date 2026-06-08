'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  ExternalLink, RefreshCw, User, Mail, Phone, Crown,
  Calendar, BookOpen, Headphones, CreditCard, BarChart2,
} from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils/formatters'
import { TestFileUploader } from '@/components/admin/TestFileUploader'
import { MockScheduleEditor, type MockSchedule } from '@/components/admin/MockScheduleEditor'

interface TestResult {
  id: string
  user_id: string
  user_email: string
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

interface Props {
  initialPayments: PaymentRequest[]
  tests: Test[]
  initialSchedules: MockSchedule[]
  initialResults: TestResult[]
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-3xl font-black" style={{ color: 'var(--accent)' }}>{results.length}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Jami natijalar</div>
        </div>
        <div className="card p-4">
          <div className="text-3xl font-black" style={{ color: 'var(--success)' }}>
            {results.length > 0
              ? (results.reduce((s, r) => s + r.band, 0) / results.length).toFixed(1)
              : '—'}
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>O&apos;rtacha band</div>
        </div>
        <div className="card p-4 hidden md:block">
          <div className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
            {new Set(results.map(r => r.user_id)).size}
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Unique foydalanuvchilar</div>
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <button onClick={refresh} disabled={refreshing} className="btn-outline text-sm flex items-center gap-2">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      {/* Table */}
      {results.length === 0 ? (
        <div className="card p-12 text-center">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Hali natijalar yo&apos;q</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="grid gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: '1fr 1fr auto auto auto',
              color: 'var(--text-muted)',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
            }}>
            <span>Foydalanuvchi</span>
            <span>Test</span>
            <span>Ball</span>
            <span>Band</span>
            <span>Sana</span>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {results.map((r) => {
              const isExpanded = expandedId === r.id
              return (
                <div key={r.id}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-opacity-50 transition-colors"
                    style={{ background: isExpanded ? 'var(--bg-secondary)' : undefined }}
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  >
                    <div className="grid gap-3 items-center"
                      style={{ gridTemplateColumns: '1fr 1fr auto auto auto' }}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {r.user_email}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                          {r.test_title}
                        </div>
                        <div className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                          {r.test_type}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-right" style={{ color: 'var(--text-primary)' }}>
                        {r.score}/40
                      </div>
                      <div className="text-sm font-bold text-right" style={{ color: bandColor(r.band) }}>
                        {r.band}
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(r.completed_at)}
                        </span>
                        {isExpanded
                          ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                          : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}>
                        <div className="px-4 pb-4 pt-2" style={{
                          background: 'var(--bg-secondary)',
                          borderTop: '1px solid var(--border)',
                        }}>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Email</p>
                              <p style={{ color: 'var(--text-secondary)' }}>{r.user_email}</p>
                            </div>
                            <div>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Test</p>
                              <p style={{ color: 'var(--text-secondary)' }}>{r.test_title}</p>
                            </div>
                            <div>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ball / Band</p>
                              <p style={{ color: bandColor(r.band), fontWeight: 700 }}>
                                {r.score}/40 — Band {r.band}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Sana</p>
                              <p style={{ color: 'var(--text-secondary)' }}>{formatDate(r.completed_at)}</p>
                            </div>
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
] as const
type TabId = typeof TABS[number]['id']

/* ── Main AdminClient ────────────────────────────────────────────────── */
export function AdminClient({ initialPayments, tests, initialSchedules, initialResults }: Props) {
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
        className="flex gap-1 mb-8 p-1 rounded-xl w-fit"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
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
    </div>
  )
}
