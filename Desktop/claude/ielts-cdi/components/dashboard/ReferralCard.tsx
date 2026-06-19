'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, CheckCircle, Users, Gift, Star } from 'lucide-react'

const APP_URL = 'https://ielts-cdi.vercel.app'
const MILESTONE = 5

interface ReferralEntry {
  id: string
  referred_name: string | null
  created_at: string
  converted_to_premium: boolean
}

function initials(name: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ReferralCard() {
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<ReferralEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dbMissing, setDbMissing] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Ensure referral code exists
      const genRes = await fetch('/api/referral/generate', { method: 'POST' })
      if (genRes.ok) {
        const { referral_code } = await genRes.json()
        setReferralCode(referral_code)
      }

      // Load stats
      const statsRes = await fetch('/api/referral/stats')
      if (statsRes.status === 503) { setDbMissing(true); return }
      if (statsRes.ok) setReferrals(await statsRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const copy = async (text: string, which: 'code' | 'link') => {
    await navigator.clipboard.writeText(text)
    if (which === 'code') { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000) }
    else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }
  }

  const totalReferred = referrals.length
  const convertedCount = referrals.filter(r => r.converted_to_premium).length
  const milestoneProgress = convertedCount % MILESTONE
  const milestonesReached = Math.floor(convertedCount / MILESTONE)
  const progressPct = (milestoneProgress / MILESTONE) * 100
  const referralLink = referralCode ? `${APP_URL}?ref=${referralCode}` : ''

  const SETUP_SQL = `-- Referral system tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text unique;

CREATE TABLE IF NOT EXISTS referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references profiles(id) on delete cascade,
  referred_id uuid references profiles(id) on delete cascade,
  referred_email text,
  referred_name text,
  created_at timestamptz default now(),
  converted_to_premium boolean default false,
  converted_at timestamptz
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Anyone can insert referral" ON referrals FOR INSERT WITH CHECK (true);
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS referral_code text;`

  if (dbMissing) {
    return (
      <div className="card p-5 mb-8" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Gift size={18} style={{ color: 'var(--warning)' }} />
          <h3 className="font-bold text-sm" style={{ color: 'var(--warning)' }}>Jadval topilmadi — Referral tizimi</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Quyidagi SQL ni Supabase SQL Editor da ishga tushiring:
        </p>
        <pre className="text-xs p-3 rounded-lg overflow-x-auto mb-2" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
          {SETUP_SQL}
        </pre>
        <button onClick={load} className="btn-outline text-xs">Qayta urinish</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card p-5 mb-8 animate-pulse" style={{ height: 180 }} />
    )
  }

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Gift size={18} style={{ color: 'var(--accent)' }} />
        <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Referral dasturi</h3>
        {milestonesReached > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
            style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Star size={10} /> {milestonesReached}× milestone
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Code */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Mening referral kodim</div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-bold text-lg tracking-widest" style={{ color: 'var(--accent)' }}>
              {referralCode ?? '...'}
            </span>
            <button
              onClick={() => referralCode && copy(referralCode, 'code')}
              className="p-1.5 rounded-lg transition-all shrink-0"
              style={{ background: copiedCode ? 'rgba(34,197,94,0.15)' : 'var(--bg-card)', color: copiedCode ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {copiedCode ? <CheckCircle size={14} /> : <Copy size={14} />}
            </button>
          </div>
          {copiedCode && <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>Nusxalandi! ✅</p>}
        </div>

        {/* Link */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Ulashing</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {referralLink || '...'}
            </span>
            <button
              onClick={() => referralLink && copy(referralLink, 'link')}
              className="p-1.5 rounded-lg transition-all shrink-0"
              style={{ background: copiedLink ? 'rgba(34,197,94,0.15)' : 'var(--bg-card)', color: copiedLink ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              {copiedLink ? <CheckCircle size={14} /> : <Copy size={14} />}
            </button>
          </div>
          {copiedLink && <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>Nusxalandi! ✅</p>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{totalReferred}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Siz orqali kelganlar</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div className="text-2xl font-black" style={{ color: 'var(--warning)' }}>{convertedCount}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Premium olganlar</div>
        </div>
      </div>

      {/* Milestone progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <Star size={12} style={{ color: 'var(--warning)' }} />
            {MILESTONE} ta odam premium olsa, siz bilan bog&apos;lanamiz!
          </span>
          <span className="font-bold" style={{ color: milestoneProgress >= MILESTONE - 1 ? 'var(--warning)' : 'var(--text-secondary)' }}>
            {milestoneProgress}/{MILESTONE}
          </span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'var(--bg-secondary)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, var(--accent), var(--warning))' }}
          />
        </div>
      </div>

      {/* Referred users list */}
      {referrals.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            <Users size={12} className="inline mr-1" />
            Kelganlar
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: r.converted_to_premium ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
                    color: r.converted_to_premium ? 'var(--warning)' : 'var(--accent)',
                  }}>
                  {initials(r.referred_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {r.referred_name ?? 'Foydalanuvchi'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(r.created_at)}</div>
                </div>
                {r.converted_to_premium && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    ⭐ Premium
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
