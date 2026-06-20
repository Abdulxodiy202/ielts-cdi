'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, CheckCircle, Gift } from 'lucide-react'

interface ReferralEntry {
  id: string
  converted_to_premium: boolean
}

const SETUP_SQL = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text unique;

CREATE TABLE IF NOT EXISTS referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references profiles(id) on delete cascade,
  referred_id uuid references profiles(id) on delete cascade,
  referred_email text, referred_name text,
  created_at timestamptz default now(),
  converted_to_premium boolean default false, converted_at timestamptz
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Anyone can insert referral" ON referrals FOR INSERT WITH CHECK (true);
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS referral_code text;`

export function ReferralCard() {
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [convertedCount, setConvertedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dbMissing, setDbMissing] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const genRes = await fetch('/api/referral/generate', { method: 'POST' })
      if (genRes.ok) {
        const { referral_code } = await genRes.json()
        setReferralCode(referral_code)
      }
      const statsRes = await fetch('/api/referral/stats')
      if (statsRes.status === 503) { setDbMissing(true); return }
      if (statsRes.ok) {
        const data: ReferralEntry[] = await statsRes.json()
        setConvertedCount(data.filter(r => r.converted_to_premium).length)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const copyCode = async () => {
    if (!referralCode) return
    await navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (dbMissing) {
    return (
      <div className="card p-5 mb-8" style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Gift size={18} style={{ color: 'var(--warning)' }} />
          <h3 className="font-bold text-sm" style={{ color: 'var(--warning)' }}>Jadval topilmadi — Referral tizimi</h3>
        </div>
        <pre className="text-xs p-3 rounded-lg overflow-x-auto mb-3" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
          {SETUP_SQL}
        </pre>
        <button onClick={load} className="btn-outline text-xs">Qayta urinish</button>
      </div>
    )
  }

  if (loading) return <div className="card mb-8 animate-pulse" style={{ height: 80 }} />

  return (
    <div className="card p-4 mb-8 flex items-center gap-4 flex-wrap">
      <Gift size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />

      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Mening referral kodim:</span>
        <span className="font-mono font-bold text-base tracking-widest" style={{ color: 'var(--accent)' }}>
          {referralCode ?? '...'}
        </span>
        <button
          onClick={copyCode}
          className="p-1.5 rounded-lg transition-all"
          style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'var(--bg-secondary)', color: copied ? 'var(--success)' : 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
        </button>
        {copied && <span className="text-xs" style={{ color: 'var(--success)' }}>Nusxalandi!</span>}
      </div>

      <div className="ml-auto flex items-center gap-1.5 text-sm">
        <span style={{ color: 'var(--text-muted)' }}>Premium olganlar:</span>
        <span className="font-bold" style={{ color: 'var(--warning)' }}>{convertedCount}</span>
      </div>
    </div>
  )
}
