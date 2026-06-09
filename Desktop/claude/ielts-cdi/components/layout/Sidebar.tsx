'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Headphones, Calendar,
  BarChart2, LogOut, Menu, X, Crown, Zap, CheckCircle, Camera,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useTheme } from '@/components/providers/ThemeProvider'
import { createClient } from '@/lib/supabase/client'
import { PaymentModal } from '@/components/PaymentModal'
import { ToastContainer, type ToastData } from '@/components/ui/Toast'
import { isActivePremium } from '@/lib/utils/premium'

const nav = [
  { href: '/dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/reading',    label: 'Reading Tests',    icon: BookOpen },
  { href: '/listening',  label: 'Listening Tests',  icon: Headphones },
  { href: '/mock-test',  label: 'Mock Test',        icon: Calendar },
  { href: '/results',    label: 'My Results',       icon: BarChart2 },
]

interface Profile {
  full_name: string | null
  avatar_url: string | null
  is_premium: boolean
  premium_since: string | null
  premium_until: string | null
}

/** "09 Jun 2026" */
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function displayPremiumSince(profile: Profile): string {
  if (profile.premium_since) return fmtDate(profile.premium_since)
  if (!profile.premium_until) return '—'
  const d = new Date(profile.premium_until)
  d.setDate(d.getDate() - 30)
  return fmtDate(d.toISOString())
}

/* ═══════════════════════════════════════════════════════════════════════
   Sidebar
   ══════════════════════════════════════════════════════════════════════ */
export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mobileOpen,      setMobileOpen]      = useState(false)
  const [upgradeOpen,     setUpgradeOpen]      = useState(false)
  const [profileOpen,     setProfileOpen]      = useState(false)
  const [profile,         setProfile]          = useState<Profile | null>(null)
  const [toasts,          setToasts]           = useState<ToastData[]>([])
  const [nameInput,       setNameInput]        = useState('')
  const [nameSaving,      setNameSaving]       = useState(false)
  const [avatarUploading, setAvatarUploading]  = useState(false)
  const [localAvatarUrl,  setLocalAvatarUrl]   = useState<string | null>(null)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const profileRef    = useRef<Profile | null>(null)
  useEffect(() => { profileRef.current = profile }, [profile])

  /* ── Initial profile fetch ─────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    // Try with premium_since first; fall back if column not yet migrated (pg 42703)
    supabase
      .from('profiles')
      .select('full_name, avatar_url, is_premium, premium_since, premium_until')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (data) { setProfile(data as unknown as Profile); return }
        if (error?.code === '42703') {
          supabase
            .from('profiles')
            .select('full_name, avatar_url, is_premium, premium_until')
            .eq('id', user.id)
            .single()
            .then(({ data: d2 }) => {
              if (d2) setProfile({ ...(d2 as unknown as Profile), premium_since: null })
            })
        }
      })
  }, [user?.id])

  // Sync name input whenever popup opens
  useEffect(() => {
    if (profileOpen) setNameInput(profile?.full_name ?? '')
  }, [profileOpen, profile?.full_name])

  /* ── Toast helpers ─────────────────────────────────────────────────── */
  const addToast = useCallback((message: string, type: ToastData['type']) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  /* ── Realtime subscriptions ────────────────────────────────────────── */
  useEffect(() => {
    if (!user?.id) return
    const supabase = createClient()

    const profileChannel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Profile
          const merged: Profile = {
            ...updated,
            premium_since: (payload.new as Profile).premium_since ?? null,
          }
          const wasPremium = isActivePremium(profileRef.current)
          setProfile(merged)
          if (isActivePremium(updated) && !wasPremium) {
            addToast('🎉 Premium obunangiz faollashtirildi! Barcha testlar ochiq.', 'premium')
          }
        }
      )
      .subscribe()

    const bookingChannel = supabase
      .channel(`bookings-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mock_bookings', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { status: string; booking_date: string; time_slot: string }
          if (row.status === 'confirmed') {
            addToast(`✅ Mock Test tasdiqlandi! ${row.booking_date} kuni ${row.time_slot}`, 'booking')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(bookingChannel)
    }
  }, [user?.id, addToast])

  /* ── Avatar upload ─────────────────────────────────────────────────── */
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { addToast('Rasm 2 MB dan kichik bo\'lishi kerak', 'error'); return }

    setAvatarUploading(true)
    // Preview immediately
    const objectUrl = URL.createObjectURL(file)
    setLocalAvatarUrl(objectUrl)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}` // cache-bust

      // Persist to profile
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl }),
      })

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
      setLocalAvatarUrl(publicUrl)
      addToast('✅ Rasm yangilandi', 'success')
    } catch {
      setLocalAvatarUrl(null)
      addToast('Rasm yuklashda xatolik', 'error')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [user, addToast])

  /* ── Save name ─────────────────────────────────────────────────────── */
  const handleSaveName = useCallback(async () => {
    if (!nameInput.trim()) return
    setNameSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: nameInput.trim() }),
    })
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, full_name: nameInput.trim() } : prev)
      addToast('✅ Ism saqlandi', 'success')
    } else {
      addToast('Saqlashda xatolik', 'error')
    }
    setNameSaving(false)
  }, [nameInput, addToast])

  /* ── Derived values ────────────────────────────────────────────────── */
  const displayName  = profile?.full_name || (user?.user_metadata?.full_name as string | undefined) || 'User'
  const avatarLetter = displayName[0].toUpperCase()
  const isPremium    = isActivePremium(profile)
  const avatarUrl    = localAvatarUrl ?? profile?.avatar_url ?? null

  /* ── Sidebar markup ────────────────────────────────────────────────── */
  const sidebarContent = (
    <div
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      className="flex flex-col h-full w-[260px]"
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm"
            style={{ background: 'var(--accent)' }}
          >
            IC
          </div>
          <div>
            <div className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>IELTS CDI</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Practice Platform</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'white' : 'var(--text-secondary)',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Theme switcher */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Theme</div>
        <div className="flex gap-2">
          {([
            { id: 'dark',  color: '#6366f1', label: 'Dark' },
            { id: 'light', color: '#94a3b8', label: 'Light' },
            { id: 'cyber', color: '#10b981', label: 'Cyber' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.label}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{
                background: t.color,
                borderColor: theme === t.id ? 'white' : 'transparent',
                transform: theme === t.id ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* User section */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        {user && (
          <div className="relative">
            {/* Avatar row — click to open popup */}
            <button
              type="button"
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-3 w-full mb-3 rounded-xl px-2 py-1.5 -mx-2 transition-colors hover:opacity-80"
              style={{ background: profileOpen ? 'rgba(99,102,241,0.08)' : 'transparent' }}
            >
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 relative flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'var(--accent)' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  : avatarLetter}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {displayName}
                </div>
                <div className="text-xs mt-0.5">
                  {isPremium ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <CheckCircle size={10} /> Premium
                    </span>
                  ) : (
                    <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Zap size={10} /> Free Plan
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Profile settings popup */}
            <AnimatePresence>
              {profileOpen && (
                <>
                  {/* Click-outside backdrop */}
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />

                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 right-0 mb-2 z-20 rounded-2xl overflow-hidden shadow-2xl"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />

                    <div className="p-4 space-y-4">
                      {/* Avatar upload */}
                      <div className="flex justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="relative group"
                          title="Rasm o'zgartirish"
                        >
                          <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white"
                            style={{ background: 'var(--accent)' }}>
                            {avatarUrl
                              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                              : avatarLetter}
                          </div>
                          {/* Hover overlay */}
                          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {avatarUploading
                              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : <Camera size={16} className="text-white" />}
                          </div>
                        </button>
                      </div>

                      {/* Name field */}
                      <div>
                        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          Ism
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                            placeholder="Ismingiz"
                            className="input-field text-sm flex-1 py-2"
                          />
                          <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={nameSaving || !nameInput.trim()}
                            className="btn-primary text-xs px-3 py-2 shrink-0 disabled:opacity-50"
                          >
                            {nameSaving ? '...' : 'Saqlash'}
                          </button>
                        </div>
                      </div>

                      {/* Subscription info */}
                      <div className="rounded-xl px-3 py-2.5 text-xs"
                        style={{
                          background: isPremium ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)',
                          border: `1px solid ${isPremium ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                        }}>
                        {isPremium ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 font-semibold text-sm" style={{ color: 'var(--warning)' }}>
                              <Crown size={13} /> Premium obuna aktiv
                            </div>
                            <div className="flex justify-between pt-0.5" style={{ color: 'var(--text-muted)' }}>
                              <span>Boshlangan:</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{profile ? displayPremiumSince(profile) : '—'}</span>
                            </div>
                            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                              <span>Tugaydi:</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(profile?.premium_until ?? null)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                              <Zap size={12} /> Oddiy foydalanuvchi
                            </div>
                            <button
                              type="button"
                              onClick={() => { setProfileOpen(false); setUpgradeOpen(true) }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity"
                              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                            >
                              <Crown size={12} /> Upgrade to Premium
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Upgrade button — always visible for non-premium */}
        {!isPremium && (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white mb-3 transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}
          >
            <Crown size={15} /> Upgrade to Premium
          </button>
        )}

        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full text-sm px-3 py-2 rounded-lg transition-all"
          style={{ color: 'var(--error)' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed top-0 left-0 h-full z-40">
        {sidebarContent}
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="fixed top-0 left-0 h-full z-50 md:hidden"
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Premium upgrade modal */}
      <PaymentModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onSuccess={() => { setUpgradeOpen(false) }}
        type="premium"
        amount={119000}
        initialName={profile?.full_name ?? ''}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
