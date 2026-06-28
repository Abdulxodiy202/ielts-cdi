'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Headphones, Calendar, Library, Users,
  LogOut, Menu, X, Crown, Zap, CheckCircle, Camera, Bell, MessageSquarePlus,
  PenLine, Mic, BookMarked, FileText, Video, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { PaymentModal } from '@/components/PaymentModal'
import { ToastContainer, type ToastData } from '@/components/ui/Toast'
import { isActivePremium } from '@/lib/utils/premium'

interface Profile {
  full_name: string | null
  avatar_url: string | null
  is_premium: boolean
  premium_since: string | null
  premium_until: string | null
}

interface AdminMessage {
  id: string
  message: string
  is_read: boolean
  created_at: string
}

function fmtMsgTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const hhmm = d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return hhmm
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Kecha ${hhmm}`
  return `${d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })} ${hhmm}`
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

/* в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
   Sidebar
   в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ */
export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t, lang, setLang } = useLanguage()
  const [mobileOpen,      setMobileOpen]      = useState(false)
  const [upgradeOpen,     setUpgradeOpen]      = useState(false)
  const [profileOpen,     setProfileOpen]      = useState(false)
  const [profile,         setProfile]          = useState<Profile | null>(null)
  const [toasts,          setToasts]           = useState<ToastData[]>([])
  const [nameInput,       setNameInput]        = useState('')
  const [nameSaving,      setNameSaving]       = useState(false)
  const [avatarUploading, setAvatarUploading]  = useState(false)
  const [localAvatarUrl,  setLocalAvatarUrl]   = useState<string | null>(null)
  const [messages,        setMessages]         = useState<AdminMessage[]>([])
  const [msgsOpen,        setMsgsOpen]         = useState(false)
  const [msgTableMissing, setMsgTableMissing]  = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const profileRef    = useRef<Profile | null>(null)
  useEffect(() => { profileRef.current = profile }, [profile])

  const navGroups = [
    {
      label: '',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
      ],
    },
    {
      label: "KO'NIKMALAR",
      items: [
        { href: '/reading',   label: 'Reading',  icon: BookOpen,   badge: null },
        { href: '/listening', label: 'Listening', icon: Headphones, badge: null },
        { href: '/writing',   label: 'Writing',  icon: PenLine,    badge: 'ai' },
        { href: '/speaking',  label: 'Speaking', icon: Mic,        badge: 'ai' },
      ],
    },
    {
      label: 'IMTIHON',
      items: [
        { href: '/mock-test', label: 'Mock Test', icon: Calendar, badge: 'book' },
      ],
    },
    {
      label: 'RESURSLAR',
      items: [
        { href: '/vocabulary',    label: 'Vocabulary',   icon: Library,     badge: null },
        { href: '/books',          label: 'Kitoblar',     icon: BookOpen,    badge: null },
        { href: '/articles',       label: 'Articles',     icon: FileText,    badge: null },
        { href: '/coming-soon',   label: 'Video darslar', icon: Video,      badge: 'pro' },
      ],
    },
    {
      label: 'BOSHQA',
      items: [
        { href: '/community', label: 'Community', icon: Users,             badge: null },
        { href: '/feedback',  label: 'Feedback',  icon: MessageSquarePlus, badge: null },
      ],
    },
  ]

  /* в”Ђв”Ђ Initial profile fetch в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
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

  /* в”Ђв”Ђ Toast helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  const addToast = useCallback((message: string, type: ToastData['type']) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  /* в”Ђв”Ђ Realtime subscriptions в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
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
            addToast(`вњ… Mock Test tasdiqlandi! ${row.booking_date} kuni ${row.time_slot}`, 'booking')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(profileChannel)
      supabase.removeChannel(bookingChannel)
    }
  }, [user?.id, addToast])

  /* ── Admin messages: fetch + 10-second polling ───────────────────────── */
  useEffect(() => {
    if (!user?.id) return

    const fetchMsgs = () =>
      fetch('/api/messages')
        .then(res => {
          if (res.status === 503) { setMsgTableMissing(true); return }
          if (res.ok) res.json().then((data: AdminMessage[]) => setMessages(data))
        })
        .catch(() => null)

    fetchMsgs()
    const interval = setInterval(fetchMsgs, 10000)
    return () => clearInterval(interval)
  }, [user?.id])

  // Close messages panel on outside click
  useEffect(() => {
    if (!msgsOpen) return
    const handler = (e: MouseEvent) => {
      if (msgsRef.current && !msgsRef.current.contains(e.target as Node)) {
        setMsgsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [msgsOpen])

  const handleMsgsOpen = async () => {
    const willOpen = !msgsOpen
    setMsgsOpen(willOpen)
    if (willOpen) {
      const unread = messages.filter(m => !m.is_read)
      if (unread.length > 0) {
        setMessages(prev => prev.map(m => ({ ...m, is_read: true })))
        fetch('/api/messages/mark-read', { method: 'POST' }).catch(() => null)
      }
    }
  }

  /* в”Ђв”Ђ Avatar upload в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Instant local preview
    setAvatarUploading(true)
    setLocalAvatarUrl(URL.createObjectURL(file))

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error ?? 'Upload failed')

      setProfile(prev => prev ? { ...prev, avatar_url: json.publicUrl } : prev)
      setLocalAvatarUrl(json.publicUrl)
      addToast('✅ Rasm yangilandi', 'success')
    } catch (err) {
      console.error('[avatar upload]', err)
      setLocalAvatarUrl(null)
      addToast(err instanceof Error ? err.message : 'Rasm yuklashda xatolik', 'error')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [user, addToast])

  /* в”Ђв”Ђ Save name в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
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

  /* в”Ђв”Ђ Derived values в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  const displayName  = profile?.full_name || (user?.user_metadata?.full_name as string | undefined) || 'User'
  const avatarLetter = displayName[0].toUpperCase()
  const isPremium    = isActivePremium(profile)
  const avatarUrl    = localAvatarUrl ?? profile?.avatar_url ?? null

  /* в”Ђв”Ђ Sidebar markup в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */
  const sidebarContent = (
    <div
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      className="flex flex-col h-full w-[260px]"
    >
      {/* Logo */}
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
          <svg width="36" height="40" viewBox="0 0 36 40" fill="none">
            <path d="M18 0L0 7V20C0 30 8 38 18 40C28 38 36 30 36 20V7L18 0Z" fill="#1e40af"/>
            <path d="M18 4L4 10V20C4 28 10 35 18 37C26 35 32 28 32 20V10L18 4Z" fill="#2563eb"/>
            <path d="M13 20L16.5 23.5L23 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
              <span style={{ color: 'white', fontWeight: '800', fontSize: '20px', letterSpacing: '1px' }}>IELTS</span>
              <span style={{ color: '#60a5fa', fontWeight: '700', fontSize: '14px' }}>.PRO</span>
            </div>
            <div style={{ color: '#93c5fd', fontSize: '8px', letterSpacing: '2px', fontWeight: '600' }}>BAND 9 STARTS HERE.</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 overflow-y-auto" style={{ paddingTop: '8px' }}>
        {navGroups.map(group => (
          <div key={group.label || '_top'} className="mb-4">
            {group.label && (
              <div className="px-3 mb-1" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, badge }) => {
                const active = pathname === href || (href !== '/coming-soon' && pathname.startsWith(href + '/'))
                return (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={16} style={{ flexShrink: 0 }} />
                    <span className="flex-1">{label}</span>
                    {badge === 'ai' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', lineHeight: '16px' }}>AI</span>
                    )}
                    {badge === 'book' && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', lineHeight: '16px' }}>📖</span>
                    )}
                    {badge === 'pro' && !isPremium && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', lineHeight: '16px' }}>Pro</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Theme switcher */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>{t('common.theme')}</div>
        <div className="flex gap-2">
          {([
            { id: 'dark'  as const, color: '#6366f1', label: t('common.dark')  },
            { id: 'light' as const, color: '#94a3b8', label: t('common.light') },
            { id: 'cyber' as const, color: '#10b981', label: t('common.cyber') },
          ]).map(thm => (
            <button
              key={thm.id}
              onClick={() => setTheme(thm.id)}
              title={thm.label}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{
                background: thm.color,
                borderColor: theme === thm.id ? 'white' : 'transparent',
                transform: theme === thm.id ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* User section */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        {user && !msgTableMissing && (
          <div ref={msgsRef} className="relative mb-3">
            <button
              onClick={handleMsgsOpen}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: msgsOpen ? 'rgba(99,102,241,0.1)' : 'transparent', color: 'var(--text-secondary)' }}
            >
              <Bell size={16} />
              <span>Xabarlar</span>
              {messages.filter(m => !m.is_read).length > 0 && (
                <span className="ml-auto flex items-center justify-center rounded-full text-white font-bold"
                  style={{ background: '#ef4444', minWidth: 18, height: 18, padding: '0 4px', fontSize: 11 }}>
                  {messages.filter(m => !m.is_read).length > 99 ? '99+' : messages.filter(m => !m.is_read).length}
                </span>
              )}
            </button>
            <AnimatePresence>
              {msgsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMsgsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 right-0 mb-2 z-20 rounded-2xl overflow-hidden shadow-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 -8px 32px rgba(0,0,0,0.3)', maxHeight: '340px', display: 'flex', flexDirection: 'column' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-4 py-2.5 text-xs font-semibold shrink-0" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Admin xabarlari
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {messages.length === 0 ? (
                        <div className="p-6 text-center">
                          <Bell size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hali xabar yo&apos;q</p>
                        </div>
                      ) : (
                        <div>
                          {messages.map((msg, i) => (
                            <div key={msg.id} className="px-4 py-2.5" style={{ background: !msg.is_read ? 'rgba(99,102,241,0.05)' : 'transparent', borderBottom: i < messages.length - 1 ? '1px solid var(--border)' : 'none', opacity: !msg.is_read ? 1 : 0.75 }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Admin</span>
                                {!msg.is_read && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ef4444' }} />}
                                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{fmtMsgTime(msg.created_at)}</span>
                              </div>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {user && (
          <div className="relative">
            {/* Avatar row вЂ” click to open popup */}
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
                      <CheckCircle size={10} /> {t('nav.premiumBadge')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Zap size={10} /> {t('nav.freePlan')}
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
                          title={lang === 'uz' ? "Rasm o'zgartirish" : 'Change photo'}
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
                          {t('common.name')}
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                            placeholder={lang === 'uz' ? 'Ismingiz' : 'Your name'}
                            className="input-field text-sm flex-1 py-2"
                          />
                          <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={nameSaving || !nameInput.trim()}
                            className="btn-primary text-xs px-3 py-2 shrink-0 disabled:opacity-50"
                          >
                            {nameSaving ? '...' : t('common.save')}
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
                              <Crown size={13} /> {t('common.premiumActive')}
                            </div>
                            <div className="flex justify-between pt-0.5" style={{ color: 'var(--text-muted)' }}>
                              <span>{t('common.premiumSince')}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{profile ? displayPremiumSince(profile) : '—'}</span>
                            </div>
                            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                              <span>{t('common.premiumUntil')}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{fmtDate(profile?.premium_until ?? null)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                              <Zap size={12} /> {t('common.normalUser')}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setProfileOpen(false); setUpgradeOpen(true) }}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity"
                              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                            >
                              <Crown size={12} /> {t('common.upgradeToPremium')}
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

        {/* Upgrade button вЂ” always visible for non-premium */}
        {!isPremium && (
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white mb-3 transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}
          >
            <Crown size={15} /> {t('common.upgradeToPremium')}
          </button>
        )}

        {/* Language switcher */}
        <div style={{ display: 'flex', gap: '8px', padding: '8px 0' }}>
          <button
            onClick={() => setLang('en')}
            style={{
              width: '48px',
              height: '32px',
              border: lang === 'en' ? '2px solid #6366f1' : '2px solid transparent',
              borderRadius: '6px',
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              opacity: lang === 'en' ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            <img
              src="https://flagcdn.com/w80/us.png"
              alt="English"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </button>
          <button
            onClick={() => setLang('uz')}
            style={{
              width: '48px',
              height: '32px',
              border: lang === 'uz' ? '2px solid #6366f1' : '2px solid transparent',
              borderRadius: '6px',
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              opacity: lang === 'uz' ? 1 : 0.5,
              transition: 'all 0.2s',
            }}
          >
            <img
              src="https://flagcdn.com/w80/uz.png"
              alt="Uzbek"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </button>
        </div>

        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full text-sm px-3 py-2 rounded-lg transition-all"
          style={{ color: 'var(--error)' }}
        >
          <LogOut size={16} /> {t('nav.signOut')}
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
        amount={50000}
        initialName={profile?.full_name ?? ''}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}

