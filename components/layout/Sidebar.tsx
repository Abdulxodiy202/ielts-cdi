'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, Headphones, Calendar, Library, Users,
  LogOut, Menu, X, Crown, Zap, CheckCircle, Camera, Bell, MessageSquarePlus,
  PenLine, Mic, FileText, Video, Globe, Pencil,
  ChevronLeft, ChevronRight, Sun, Moon, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useTheme } from '@/components/providers/ThemeProvider'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { createClient } from '@/lib/supabase/client'
import { ToastContainer, type ToastData } from '@/components/ui/Toast'
import { isActivePremium } from '@/lib/utils/premium'

// Modals only ever open on user interaction (Upgrade button, avatar click,
// username edit). Lazy-loading pulls PaymentModal (+ its payment form,
// file upload, framer-motion overlays), AvatarViewModal, and
// UsernameEditModal out of the initial sidebar bundle — every dashboard
// page pays this cost otherwise. ssr:false because they render nothing
// until opened and their internals use browser-only APIs.
const PaymentModal      = dynamic(() => import('@/components/PaymentModal').then(m => ({ default: m.PaymentModal })),           { ssr: false })
const AvatarViewModal   = dynamic(() => import('@/components/AvatarViewModal').then(m => ({ default: m.AvatarViewModal })),    { ssr: false })
const UsernameEditModal = dynamic(() => import('@/components/UsernameEditModal').then(m => ({ default: m.UsernameEditModal })), { ssr: false })

interface Profile {
  full_name: string | null
  display_name: string | null
  username: string | null
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

// ── Rail tooltip: overflow-x-hidden nav container'idan tashqariga
// chiqish uchun portal orqali document.body'da fixed pozitsiya bilan
// render qilinadi. Anchor rect'ini hover payti o'lchaymiz -- hech
// qanday CSS group-hover trick'i overflow'ni chetlab o'ta olmagan
// bo'lardi. Faqat client'da: SSR paytida hech nima render qilmaymiz.
function RailTooltip({
  anchor, label, show,
}: {
  anchor: React.RefObject<HTMLElement | null>
  label: string
  show: boolean
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!show || !anchor.current) { setPos(null); return }
    const rect = anchor.current.getBoundingClientRect()
    setPos({ left: rect.right + 12, top: rect.top + rect.height / 2 })
  }, [show, anchor])

  if (!show || !pos || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        zIndex: 9999,
        background: '#0a0a0a',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Arrow (uchi) */}
      <span
        style={{
          position: 'absolute',
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          borderStyle: 'solid',
          borderWidth: '5px 5px 5px 0',
          borderColor: 'transparent #0a0a0a transparent transparent',
        }}
      />
      {label}
    </div>,
    document.body,
  )
}

// Hover'ni fixed-position tooltip bilan bog'lash uchun kichik wrapper.
// `enabled=true` bo'lganda bolalar ustidagi mouseenter/leave tooltip'ni
// ochib-yopadi. Enabled=false bo'lsa hech qanday tooltip render bo'lmaydi.
function RailAnchor({
  enabled, label, className, children,
}: {
  enabled: boolean
  label: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={ref}
      className={className}
      onMouseEnter={() => enabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      <RailTooltip anchor={ref} label={label} show={enabled && hover} />
    </div>
  )
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
  const { collapsed, toggle } = useSidebar()

  // Main-content margin'i CSS var(--sidebar-width) orqali harakat qiladi
  // (globals.css'da transition tayyor). Collapsed holatini shu joyda
  // sinxronlaymiz -- boshqa fayllarni tegishga hojat qolmaydi.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '72px' : '260px')
  }, [collapsed])

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
  const [avatarViewOpen,  setAvatarViewOpen]   = useState(false)
  const [usernameEditOpen, setUsernameEditOpen] = useState(false)

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

  // `color` -- faqat Reading/Listening/Writing/Speaking uchun beriladi
  // (har biri o'z rangida ajralib turishi uchun); qolgan itemlarda
  // undefined bo'lib, pastdagi render default `var(--accent)`ga tushadi.
  const navGroups: { label: string; items: { href: string; label: string; icon: LucideIcon; badge: 'ai' | 'book' | 'pro' | null; color?: string }[] }[] = [
    {
      label: '',
      items: [
        { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, badge: null, color: undefined },
      ],
    },
    {
      label: t('nav.skillsGroup'),
      items: [
        { href: '/reading',   label: t('nav.reading'),   icon: BookOpen,   badge: null, color: 'var(--skill-reading)' },
        { href: '/listening', label: t('nav.listening'), icon: Headphones, badge: null, color: 'var(--skill-listening)' },
        { href: '/writing',   label: t('nav.writing'),   icon: PenLine,    badge: 'ai', color: 'var(--skill-writing)' },
        { href: '/speaking',  label: t('nav.speaking'),  icon: Mic,        badge: 'ai', color: 'var(--skill-speaking)' },
      ],
    },
    {
      label: t('nav.examGroup'),
      items: [
        { href: '/mock-test', label: t('nav.mockTest'), icon: Calendar, badge: 'book', color: undefined },
      ],
    },
    {
      label: t('nav.resourcesGroup'),
      items: [
        { href: '/vocabulary',  label: t('nav.vocabulary'),   icon: Library,             badge: null, color: undefined },
        { href: '/books',       label: t('nav.books'),        icon: BookOpen,            badge: null, color: undefined },
        { href: '/articles',    label: t('nav.articles'),     icon: FileText,            badge: null, color: undefined },
        { href: '/video-lessons', label: t('nav.videoCourses'), icon: Video,               badge: null, color: undefined },
      ],
    },
    {
      label: t('nav.otherGroup'),
      items: [
        { href: '/community', label: t('nav.community'), icon: Users,             badge: null, color: undefined },
        { href: '/feedback',  label: t('nav.feedback'),  icon: MessageSquarePlus, badge: null, color: undefined },
      ],
    },
  ]

  /* ── Profile fetch ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    // Try the full column set first (includes the newer display_name and
    // username fields). On 42703 (undefined_column) we retry with the
    // legacy shape so pre-migration environments keep loading. Missing
    // fields default to null downstream.
    supabase
      .from('profiles')
      .select('full_name, display_name, username, avatar_url, is_premium, premium_since, premium_until')
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
              if (d2) setProfile({
                ...(d2 as unknown as Profile),
                display_name: null,
                username: null,
                premium_since: null,
              })
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
    // Sync BOTH columns. The dashboard greeting reads display_name first
    // (`display_name || full_name?.split(' ')[0]`), so writing only
    // full_name here left the greeting on the pre-existing display_name
    // and looked like the save "didn't stick" -- even though the row was
    // updated. Sending both keeps the two labels in lockstep from every
    // edit surface (sidebar inline, DisplayNameModal, future settings).
    const trimmed = nameInput.trim()
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: trimmed, display_name: trimmed }),
    })
    if (res.ok) {
      // Patch BOTH fields locally too -- the derived `displayName` below
      // reads display_name first, so leaving it stale here kept showing
      // the old name until a full reload even though the PATCH (and the
      // DB row) already had the new value.
      setProfile(prev => prev ? { ...prev, full_name: trimmed, display_name: trimmed } : prev)
      addToast(t('sidebar.nameSaved'), 'success')
    } else {
      addToast(t('sidebar.nameSaveError'), 'error')
    }
    setNameSaving(false)
    setEditingName(false)
  }, [nameInput, addToast, t])

  /* ── Derived values ────────────────────────────────────────────── */
  const displayName  = profile?.display_name || profile?.full_name || (user?.user_metadata?.full_name as string | undefined) || 'User'
  const username     = profile?.username ?? null
  const avatarLetter = displayName[0].toUpperCase()
  const isPremium    = isActivePremium(profile)
  const avatarUrl    = localAvatarUrl ?? profile?.avatar_url ?? null
  const unreadCount  = messages.filter(m => !m.is_read).length

  /* ── Sidebar markup ────────────────────────────────────────────── */
  // `mini` -- collapsed uslubi (72px, matnlar yashirin, ikon markazda).
  // Mobile drawer doim `mini=false` bilan chaqiriladi -- drawer to'liq
  // matn bilan ochilishi kerak.
  const renderSidebar = (mini: boolean) => (
    <div style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      className={`flex flex-col h-full ${mini ? 'w-[72px]' : 'w-[260px]'} transition-[width] duration-300 ease-in-out`}>

      {/* Logo */}
      <div className={`${mini ? 'px-3' : 'px-6'} py-4 border-b`} style={{ borderColor: 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: mini ? 'center' : 'space-between', gap: '10px', padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <svg width="36" height="40" viewBox="0 0 36 40" fill="none" style={{ flexShrink: 0 }}>
              <path d="M18 0L0 7V20C0 30 8 38 18 40C28 38 36 30 36 20V7L18 0Z" fill="#1e40af"/>
              <path d="M18 4L4 10V20C4 28 10 35 18 37C26 35 32 28 32 20V10L18 4Z" fill="#2563eb"/>
              <path d="M13 20L16.5 23.5L23 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!mini && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '20px', letterSpacing: '1px' }}>IELTS</span>
                  <span style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '14px' }}>.PRO</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '8px', letterSpacing: '2px', fontWeight: '600' }}>BAND 9 STARTS HERE.</div>
              </div>
            )}
          </div>
          {/* Tema tugmasi (quyosh/oy) -- admin paneldagi bilan bir xil
              uslub, sidebar'da doim ko'rinib turadi. Mini (yig'ilgan)
              holatda joy yetishmagani uchun yashiringan -- o'sha holatda
              tema hali ham profil dropdown'idagi eski tanlov orqali
              o'zgartiriladi. 2026-08-28 qo'shildi. */}
          {!mini && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={t('common.theme')}
              className="flex items-center justify-center rounded-full transition-all hover:opacity-80"
              style={{
                width: 32, height: 32, flexShrink: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className={`flex-1 ${mini ? 'p-2' : 'p-4'} overflow-y-auto overflow-x-hidden`} style={{ paddingTop: '8px' }}>
        {navGroups.map(group => (
          <div key={group.label || '_top'} className="mb-4">
            {group.label && (
              mini
                ? <div className="mx-2 my-3" style={{ borderTop: '1px solid var(--border)' }} />
                : (
                  <div className="px-3 mb-1" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {group.label}
                  </div>
                )
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, badge, color }) => {
                const active = pathname === href || (href !== '/coming-soon' && pathname.startsWith(href + '/'))
                const itemColor = color || 'var(--accent)'
                return (
                  <RailAnchor key={label} enabled={mini} label={label}>
                    <Link href={href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center ${mini ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium transition-all`}
                      style={{ background: active ? itemColor : 'transparent', color: active ? 'white' : 'var(--text-secondary)' }}>
                      <Icon size={mini ? 18 : 16} style={{ flexShrink: 0, color: active ? 'white' : (color || 'currentColor') }} />
                      {!mini && <span className="flex-1">{label}</span>}
                      {!mini && badge === 'ai' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', lineHeight: '16px' }}>AI</span>}
                      {!mini && badge === 'book' && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', lineHeight: '16px' }}>📖</span>}
                      {!mini && badge === 'pro' && !isPremium && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.3)', lineHeight: '16px' }}>Pro</span>}
                    </Link>
                  </RailAnchor>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom section ─────────────────────────────────────────── */}
      {/* Mini rejimda kompakt padding + flex items-center bilan avatar
          va Upgrade tugmasi bir vertikal chiziqda markazga tushadi. */}
      <div
        className={`${mini ? 'p-3 flex flex-col items-center' : 'p-4'} border-t`}
        style={{ borderColor: 'var(--border)' }}
      >
        {user && (
          <div className="relative" ref={dropdownRef}>

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

            {/* ── Dropdown ─── */}
            {/* Sidebar yopilgan holatda menu 72px rail ustida joylashsa
                juda tor bo'lib qoladi -- shu bois o'ng tomonga chiqamiz.
                Ochilgan holatda hozirgidek yuqoriga chiqib turadi. */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, ...(collapsed ? { x: -6 } : { y: 6 }) }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, ...(collapsed ? { x: -6 } : { y: 6 }) }}
                  transition={{ duration: 0.15 }}
                  className={
                    collapsed
                      ? 'absolute bottom-0 z-50'
                      : 'absolute bottom-full left-0 right-0 z-50 mb-2'
                  }
                  style={{
                    ...(collapsed ? { left: '100%', marginLeft: 12, width: 260 } : {}),
                    background: 'var(--bg-card)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 12,
                    padding: '10px 10px 8px',
                    boxShadow: collapsed
                      ? '0 8px 32px rgba(0,0,0,0.35)'
                      : '0 -8px 24px rgba(0,0,0,0.25)',
                  }}
                >
                  {/* ── PROFIL section ─── */}
                  <div className="mb-1" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '2px 4px 6px' }}>
                    {t('sidebar.profile')}
                  </div>

                  {/* Instagram-style profile header: big avatar (bosilsa
                      viewer modal ochiladi), display_name, @username. */}
                  <div className="flex flex-col items-center gap-1.5 mb-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAvatarViewOpen(true)}
                      aria-label={t('profile.viewAvatar')}
                      className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold text-white transition-transform hover:scale-105"
                      style={{
                        background: 'var(--accent)',
                        boxShadow: '0 0 0 2px rgba(99,102,241,0.35)',
                      }}
                    >
                      {avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                        : avatarLetter}
                    </button>
                    <div className="text-sm font-bold text-center truncate max-w-full" style={{ color: 'var(--text-primary)' }}>
                      {displayName}
                    </div>
                    {username && (
                      <button
                        type="button"
                        onClick={() => setUsernameEditOpen(true)}
                        className="text-xs truncate hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={t('profile.changeUsername')}
                      >
                        @{username}
                        <Pencil size={10} />
                      </button>
                    )}
                    {!username && (
                      <button
                        type="button"
                        onClick={() => setUsernameEditOpen(true)}
                        className="text-xs hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Pencil size={10} /> {t('profile.changeUsername')}
                      </button>
                    )}
                  </div>

                  {/* Display name row (inline edit kept -- keeps old muscle memory) */}
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

                  {/* Theme row -- 2026-08-28: olib tashlandi, chunki
                      endi tema tugmasi (quyosh/oy) sidebar logosi
                      yonida doim ko'rinib turadi -- shu profil
                      dropdown'idagi eski tanlov endi ortiqcha edi. */}

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
                          <Image
                            src={`https://flagcdn.com/w80/${flag}.png`}
                            alt={code}
                            width={80}
                            height={54}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
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

                  {/* Logout -- akoundan chiqishda tema ham OQ (light)ga
                      qaytariladi, shunda keyingi kirgan (yoki yangi)
                      foydalanuvchi doim oq fon bilan boshlaydi. */}
                  <button onClick={() => { setTheme('light'); signOut() }}
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
                    initial={{ opacity: 0, scale: 0.96, ...(collapsed ? { x: -6 } : { y: 8 }) }}
                    animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, ...(collapsed ? { x: -6 } : { y: 8 }) }}
                    transition={{ duration: 0.15 }}
                    className={
                      collapsed
                        ? 'absolute bottom-0 z-50 rounded-2xl overflow-hidden shadow-2xl'
                        : 'absolute bottom-full left-0 right-0 mb-2 z-50 rounded-2xl overflow-hidden shadow-2xl'
                    }
                    style={{
                      ...(collapsed ? { left: '100%', marginLeft: 12, width: 300 } : {}),
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      boxShadow: collapsed
                        ? '0 8px 32px rgba(0,0,0,0.35)'
                        : '0 -8px 32px rgba(0,0,0,0.3)',
                      maxHeight: '340px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
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
            {/* Mini rejimda -mx-2 va w-full olib tashlanadi -- tugma
                aynan avatar o'lchamida (40x40) markazda turadi. Ochilgan
                rejimda hozirgidek to'liq kenglikda. */}
            <RailAnchor enabled={mini && !dropdownOpen} label={displayName}>
              <button
                type="button"
                onClick={() => { setDropdownOpen(o => !o); setEditingName(false) }}
                className={
                  mini
                    ? 'flex items-center justify-center rounded-xl transition-colors hover:opacity-80'
                    : 'flex items-center gap-3 px-2 w-full rounded-xl py-2 -mx-2 transition-colors hover:opacity-80'
                }
                style={{
                  ...(mini ? { width: 40, height: 40, padding: 0 } : {}),
                  background: dropdownOpen ? 'rgba(99,102,241,0.08)' : 'transparent',
                }}
              >
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: 'var(--accent)' }}>
                  {avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    : avatarLetter}
                </div>
                {unreadCount > 0 && (
                  <span
                    // Same unreadCount that already feeds the "Messages [N]"
                    // badge in the dropdown — no separate query, so the
                    // count updates in lockstep with the dropdown badge.
                    aria-label={t('sidebar.unreadMessages', { count: unreadCount })}
                    className="flex items-center justify-center font-semibold text-white"
                    style={{
                      position: 'absolute',
                      top: -4, right: -4,
                      minWidth: 18, height: 18,
                      padding: '0 5px',
                      borderRadius: 9,
                      background: '#ef4444',
                      fontSize: 11,
                      lineHeight: 1,
                      border: '2px solid var(--bg-primary)',
                    }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {!mini && (
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
              )}
              </button>
            </RailAnchor>
          </div>
        )}

        {/* Upgrade button — free users only */}
        {!isPremium && (
          mini ? (
            <RailAnchor
              enabled
              label={t('common.upgradeToPremium')}
              className="mt-3"
            >
              <button type="button" onClick={() => setUpgradeOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}>
                <Crown size={16} className="text-white" />
              </button>
            </RailAnchor>
          ) : (
            <button type="button" onClick={() => setUpgradeOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white mt-3 transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 16px rgba(245,158,11,0.35)' }}>
              <Crown size={15} /> {t('common.upgradeToPremium')}
            </button>
          )
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar (collapsed holatiga hurmat qiladi) */}
      <div className="hidden md:block fixed top-0 left-0 h-full z-40">
        {renderSidebar(collapsed)}
        {/* Chevron toggle -- sidebarning o'ng chetida chiqib turadi */}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          className="absolute w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{
            top: 100,
            right: -12,
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            zIndex: 50,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Mobile hamburger */}
      <button className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile drawer -- doim to'liq matn bilan ochiladi
          (mobile'da collapse rejimidan foyda yo'q) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 z-40 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} />
            <motion.div className="fixed top-0 left-0 h-full z-50 md:hidden"
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              {renderSidebar(false)}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals — conditionally mounted so their dynamic() imports don't
          fire until the user actually opens them. */}
      {upgradeOpen && (
        <PaymentModal
          isOpen
          onClose={() => setUpgradeOpen(false)}
          onSuccess={() => { setUpgradeOpen(false) }}
          type="premium"
          amount={50000}
          initialName={profile?.full_name ?? ''}
        />
      )}

      {/* Instagram-style avatar viewer + username editor */}
      {avatarViewOpen && (
        <AvatarViewModal
          open
          onClose={() => setAvatarViewOpen(false)}
          avatarUrl={avatarUrl}
          displayName={displayName}
        />
      )}
      {usernameEditOpen && (
        <UsernameEditModal
          open
          currentUsername={username}
          onClose={() => setUsernameEditOpen(false)}
          onSaved={(u) => setProfile(prev => prev ? { ...prev, username: u } : prev)}
        />
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
