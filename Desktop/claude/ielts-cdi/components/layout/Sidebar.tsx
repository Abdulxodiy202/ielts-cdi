'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Headphones, Calendar, Library, Users, Keyboard,
  LogOut, Menu, X, Crown, Zap, CheckCircle, Camera, Bell, MessageSquarePlus,
  PenLine, Mic, FileText, Video, Globe, Palette, Pencil,
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

function fmtMsgTime(iso: string, lang: 'en' | 'uz', yesterdayLabel: string): string {
  const locale = lang === 'en' ? 'en-US' : 'uz-UZ'
  const d = new Date(iso)
  const now = new Date()
  const hhmm = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return hhmm
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `${yesterdayLabel} ${hhmm}`
  return `${d.toLocaleDateString(locale, { day: '2-digit', month: 'short' })} ${hhmm}`
}

/* ── Sidebar ─────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { t, lang, setLang } = useLanguage()

  const [mobileOpen,      setMobileOpen]      = useState(false)
  const [upgradeOpen,     setUpgradeOpen]      = useState(false)
  const [dropdownOpen,    setDropdownOpen]     = useState(false)
  const [editingName,     setEditingName]      = useState(false)
  const [nameInput,       setNameInput]        = useState('')
  const [nameSaving,      setNameSaving]       = useState(false)
  const [avatarUploading, setAvatarUploading]  = useState(false)
  const [localAvatarUrl,  setLocalAvatarUrl]   = useState<string | null>(null)
  const [profile,         setProfile]          = useState<Profile | null>(null)
  const [toasts,          setToasts]           = useState<ToastData[]>([])
  const [messages,        setMessages]         = useState<AdminMessage[]>([])
  const [msgsOpen,        setMsgsOpen]         = useState(false)
  const [msgTableMissing, setMsgTableMissing]  = useState(false)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const profileRef    = useRef<Profile | null>(null)
  const dropdownRef   = useRef<HTMLDivElement>(null)
  useEffect(() => { profileRef.current = profile }, [profile])

  /* ── Outside click closes dropdown ─── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setEditingName(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navGroups = [
    {
      label: '',
      items: [
        { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, badge: null },
      ],
    },
    {
      label: t('nav.skillsGroup'),
      items: [
        { href: '/reading',   label: t('nav.reading'),   icon: BookOpen,   badge: null },
        { href: '/listening', label: t('nav.listening'), icon: Headphones, badge: null },
        { href: '/writing',   label: t('nav.writing'),   icon: PenLine,    badge: 'ai' },
        { href: '/speaking',  label: t('nav.speaking'),  icon: Mic,        badge: 'ai' },
      ],
    },
    {
      label: t('nav.examGroup'),
      items: [
        { href: '/mock-test', label: t('nav.mockTest'), icon: Calendar, badge: 'book' },
      ],
    },
    {
      label: t('nav.resourcesGroup'),
      items: [
        { href: '/vocabulary',  label: t('nav.vocabulary'),   icon: Library,             badge: null },
        { href: '/typing',      label: t('nav.typing'),       icon: Keyboard,            badge: null },
        { href: '/books',       label: t('nav.books'),        icon: BookOpen,            badge: null },
        { href: '/articles',    label: t('nav.articles'),     icon: FileText,            badge: null },
        { href: '/video-lessons', label: t('nav.videoCourses'), icon: Video,               badge: null },
      ],
    },
    {
      label: t('nav.otherGroup'),
      items: [
        { href: '/community', label: t('nav.community'), icon: Users,             badge: null },
        { href: '/feedback',  label: t('nav.feedback'),  icon: MessageSquarePlus, badge: null },
      ],
    },
  ]

  /* ── Profile fetch ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return
    const supabase = createClient()

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

  /* ── Toast helpers ─────────────────────────────────────────────── */
  const addToast = useCallback((message: string, type: ToastData['type']) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  /* ── Realtime subscriptions ────────────────────────────────────── */
  useEffect(() => {
    if (!user?.id) return
    const supabase = createClient()

    const profileCh = supabase
      .channel(`profile-${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Profile
          const merged: Profile = { ...updated, premium_since: (payload.new as Profile).premium_since ?? null }
          const wasPremium = isActivePremium(profileRef.current)
          setProfile(merged)
          if (isActivePremium(updated) && !wasPremium)
            addToast(t('sidebar.premiumActivatedToast'), 'premium')
        }
      ).subscribe()

    const bookingCh = supabase
      .channel(`bookings-${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mock_bookings', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { status: string; booking_date: string; time_slot: string }
          if (row.status === 'confirmed')
            addToast(t('sidebar.mockConfirmedToast', { date: row.booking_date, time: row.time_slot }), 'booking')
        }
      ).subscribe()

    return () => { supabase.removeChannel(profileCh); supabase.removeChannel(bookingCh) }
  }, [user?.id, addToast, t])

  /* ── Admin messages ────────────────────────────────────────────── */
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
    const iv = setInterval(fetchMsgs, 10000)
    return () => clearInterval(iv)
  }, [user?.id])

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

  /* ── Avatar upload ─────────────────────────────────────────────── */
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarUploading(true)
    setLocalAvatarUrl(URL.createObjectURL(file))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setProfile(prev => prev ? { ...prev, avatar_url: json.publicUrl } : prev)
      setLocalAvatarUrl(json.publicUrl)
      addToast(t('sidebar.photoUpdated'), 'success')
    } catch (err) {
      console.error('[avatar upload]', err)
      setLocalAvatarUrl(null)
      addToast(err instanceof Error ? err.message : t('sidebar.photoUploadError'), 'error')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [user, addToast, t])

  /* ── Save name ─────────────────────────────────────────────────── */
  const handleSaveName = useCallback(async () => {
    if (!nameInput.trim()) { setEditingName(false); return }
    setNameSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: nameInput.trim() }),
    })
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, full_name: nameInput.trim() } : prev)
      addToast(t('sidebar.nameSaved'), 'success')
    } else {
      addToast(t('sidebar.nameSaveError'), 'error')
    }
    setNameSaving(false)
    setEditingName(false)
  }, [nameInput, addToast, t])

  /* ── Derived values ────────────────────────────────────────────── */
  const displayName  = profile?.full_name || (user?.user_metadata?.full_name as string | undefined) || 'User'
  const avatarLetter = displayName[0].toUpperCase()
  const isPremium    = isActivePremium(profile)
  const avatarUrl    = localAvatarUrl ?? profile?.avatar_url ?? null
  const unreadCount  = messages.filter(m => !m.is_read).length

  /* ── Sidebar markup ────────────────────────────────────────────── */
  const sidebarContent = (
    <div style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      className="flex flex-col h-full w-[260px]">

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
                  <Link key={label} href={href} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'white' : 'var(--text-secondary)' }}>
                    <Icon size={16} style={{ flexShrink: 0 }} />
                    <span className="flex-1">{label}</span>
                    {badge === 'ai' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', lineHeight: '16px' }}>AI</span>}
                    {badge === 'book' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', lineHeight: '16px' }}>📖</span>}
                    {badge === 'pro' && !isPremium && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', lineHeight: '16px' }}>Pro</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom section ─────────────────────────────────────────── */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        {user && (
          <div className="relative" ref={dropdownRef}>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

            {/* ── Dropdown ─── */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-0 z-50 mb-2"
                  style={{
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 12,
                    padding: '10px 10px 8px',
                    boxShadow: '0 -8px 24px rgba(0,0,0,0.25)',
                  }}
                >
                  {/* ── PROFIL section ─── */}
                  <div className="mb-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '2px 4px 6px' }}>
                    {t('sidebar.profile')}
                  </div>

                  {/* Name row */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <Pencil size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {editingName ? (
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveName()
                          if (e.key === 'Escape') { setEditingName(false); setNameInput(displayName) }
                        }}
                        onBlur={handleSaveName}
                        className="flex-1 text-sm bg-transparent border-none outline-none"
                        style={{ color: 'var(--text-primary)', minWidth: 0 }}
                        placeholder={t('sidebar.namePlaceholder')}
                      />
                    ) : (
                      <span
                        className="flex-1 text-sm truncate cursor-text"
                        style={{ color: 'var(--text-primary)' }}
                        onClick={() => { setEditingName(true); setNameInput(displayName) }}
                      >
                        {displayName}
                      </span>
                    )}
                    {nameSaving && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--text-muted)' }} />}
                  </div>

                  {/* Avatar upload row */}
                  <button onClick={() => fileInputRef.current?.click()} disabled={avatarUploading}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors hover:opacity-80 mb-2"
                    style={{ color: 'var(--text-secondary)' }}>
                    <Camera size={13} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                    <span>{avatarUploading ? t('common.loading') : t('sidebar.uploadPhoto')}</span>
                  </button>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

                  {/* ── SOZLAMALAR section ─── */}
                  <div className="mb-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '2px 4px 6px' }}>
                    {t('sidebar.settings')}
                  </div>

                  {/* Theme row */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 hover:opacity-80">
                    <Palette size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span className="flex-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('common.theme')}</span>
                    <div className="flex gap-1.5">
                      {([
                        { id: 'dark'  as const, color: '#6366f1' },
                        { id: 'light' as const, color: '#94a3b8' },
                        { id: 'cyber' as const, color: '#10b981' },
                      ]).map(thm => (
                        <button key={thm.id} onClick={() => setTheme(thm.id)}
                          className="w-5 h-5 rounded-full border-2 transition-all"
                          style={{
                            background: thm.color,
                            borderColor: theme === thm.id ? 'white' : 'transparent',
                            transform: theme === thm.id ? 'scale(1.2)' : 'scale(1)',
                          }} />
                      ))}
                    </div>
                  </div>

                  {/* Language row */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 hover:opacity-80">
                    <Globe size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span className="flex-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('common.language')}</span>
                    <div className="flex gap-1.5">
                      {[
                        { code: 'en' as const, flag: 'us' },
                        { code: 'uz' as const, flag: 'uz' },
                      ].map(({ code, flag }) => (
                        <button key={code} onClick={() => setLang(code)} style={{
                          width: 36, height: 24, border: lang === code ? '2px solid #6366f1' : '2px solid transparent',
                          borderRadius: 4, overflow: 'hidden', cursor: 'pointer', padding: 0,
                          opacity: lang === code ? 1 : 0.45, transition: 'all 0.2s',
                        }}>
                          <img src={`https://flagcdn.com/w80/${flag}.png`} alt={code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notifications row */}
                  {!msgTableMissing && (
                    <button
                      onClick={() => { setDropdownOpen(false); handleMsgsOpen() }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-secondary)' }}>
                      <Bell size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="flex-1">{t('sidebar.messages')}</span>
                      {unreadCount > 0 && (
                        <span className="flex items-center justify-center rounded-full text-white font-bold"
                          style={{ background: '#ef4444', minWidth: 18, height: 18, padding: '0 4px', fontSize: 10 }}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0 6px' }} />

                  {/* Logout */}
                  <button onClick={signOut}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                    style={{ color: '#ef4444' }}>
                    <LogOut size={13} style={{ flexShrink: 0 }} />
                    {t('nav.signOut')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Messages popup ─── */}
            <AnimatePresence>
              {msgsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMsgsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-2xl overflow-hidden shadow-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 -8px 32px rgba(0,0,0,0.3)', maxHeight: '340px', display: 'flex', flexDirection: 'column' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="px-4 py-2.5 text-xs font-semibold shrink-0"
                      style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {t('sidebar.adminMessages')}
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {messages.length === 0 ? (
                        <div className="p-6 text-center">
                          <Bell size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('sidebar.noMessages')}</p>
                        </div>
                      ) : (
                        <div>
                          {messages.map((msg, i) => (
                            <div key={msg.id} className="px-4 py-2.5"
                              style={{ background: !msg.is_read ? 'rgba(99,102,241,0.05)' : 'transparent', borderBottom: i < messages.length - 1 ? '1px solid var(--border)' : 'none', opacity: !msg.is_read ? 1 : 0.75 }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Admin</span>
                                {!msg.is_read && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ef4444' }} />}
                                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{fmtMsgTime(msg.created_at, lang, t('sidebar.yesterday'))}</span>
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

            {/* ── Avatar card (always visible) ─── */}
            <button
              type="button"
              onClick={() => { setDropdownOpen(o => !o); setEditingName(false) }}
              className="flex items-center gap-3 w-full rounded-xl px-2 py-2 -mx-2 transition-colors hover:opacity-80"
              style={{ background: dropdownOpen ? 'rgba(99,102,241,0.08)' : 'transparent' }}
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-white"
                style={{ background: 'var(--accent)' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  : avatarLetter}
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid var(--bg-secondary)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</div>
                <div className="text-xs mt-0.5">
                  {isPremium ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <CheckCircle size={9} /> {t('nav.premiumBadge')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Zap size={9} /> {t('nav.freePlan')}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Upgrade button — free users only */}
        {!isPremium && (
          <button type="button" onClick={() => setUpgradeOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white mt-3 transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}>
            <Crown size={15} /> {t('common.upgradeToPremium')}
          </button>
        )}
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
      <button className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 z-40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} />
            <motion.div className="fixed top-0 left-0 h-full z-50 md:hidden"
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Premium modal */}
      <PaymentModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onSuccess={() => { setUpgradeOpen(false) }}
        type="premium"
        amount={50000}
        initialName={profile?.full_name ?? ''}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
