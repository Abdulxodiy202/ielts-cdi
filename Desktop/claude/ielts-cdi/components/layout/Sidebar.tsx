'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Headphones, Calendar,
  BarChart2, LogOut, Menu, X, Crown, Zap, CheckCircle,
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
  is_premium: boolean
  premium_until: string | null
}

/* ═══════════════════════════════════════════════════════════════════════
   Sidebar
   ══════════════════════════════════════════════════════════════════════ */
export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [toasts,      setToasts]      = useState<ToastData[]>([])

  // Ref so realtime callbacks always see the latest profile without stale closure
  const profileRef = useRef<Profile | null>(null)
  useEffect(() => { profileRef.current = profile }, [profile])

  /* ── Initial profile fetch ─────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('full_name, is_premium, premium_until')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [user?.id])

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

    // Watch profiles table — fires when admin grants premium
    const profileChannel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Profile
          const wasPremium = isActivePremium(profileRef.current)
          setProfile(updated)
          if (isActivePremium(updated) && !wasPremium) {
            addToast('🎉 Premium obunangiz faollashtirildi! Barcha testlar ochiq.', 'premium')
          }
        }
      )
      .subscribe()

    // Watch mock_bookings — fires when admin confirms a booking (toast only)
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

  const displayName  = profile?.full_name || (user?.user_metadata?.full_name as string | undefined) || 'User'
  const avatarLetter = displayName[0].toUpperCase()
  const isPremium    = isActivePremium(profile)

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
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {displayName}
              </div>
              <div className="text-xs mt-0.5">
                {isPremium ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    <CheckCircle size={10} /> Premium
                  </span>
                ) : (
                  <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Zap size={10} /> Free Plan
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upgrade button — only for non-premium */}
        {!isPremium && (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white mb-3 transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}
          >
            <Crown size={15} />
            Upgrade to Premium
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
