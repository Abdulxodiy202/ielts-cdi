'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface AdminMessage {
  id: string
  message: string
  is_read: boolean
  created_at: string
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Hozir'
  if (diffMin < 60) return `${diffMin} daqiqa oldin`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} soat oldin`
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function MessagesPanel() {
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [open, setOpen] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = messages.filter(m => !m.is_read).length

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/messages')
    if (res.status === 503) { setTableMissing(true); return }
    if (res.ok) {
      const data: AdminMessage[] = await res.json()
      setMessages(data)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 30000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = async () => {
    setOpen(o => !o)
    if (!open && unreadCount > 0) {
      // Optimistically mark all as read in UI
      setMessages(prev => prev.map(m => ({ ...m, is_read: true })))
      await fetch('/api/messages/mark-read', { method: 'POST' }).catch(() => null)
    }
  }

  if (tableMissing) return null

  return (
    <div ref={panelRef} className="relative mb-2">
      <button
        onClick={handleOpen}
        className="relative flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
        style={{
          background: open ? 'rgba(99,102,241,0.08)' : 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent',
        }}
      >
        <Bell size={16} />
        <span>Xabarlar</span>
        {unreadCount > 0 && (
          <span
            className="ml-auto flex items-center justify-center rounded-full text-xs font-bold text-white"
            style={{
              background: '#ef4444',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              fontSize: '11px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 z-30 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
              maxHeight: '360px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              className="px-4 py-3 text-xs font-semibold uppercase tracking-wide shrink-0"
              style={{
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              Admin xabarlari
            </div>

            <div className="overflow-y-auto flex-1">
              {messages.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hali xabar yo&apos;q</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className="px-4 py-3"
                      style={{
                        background: !msg.is_read ? 'rgba(99,102,241,0.04)' : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: 'var(--accent)' }}
                        >
                          Admin
                        </span>
                        {!msg.is_read && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: '#ef4444' }}
                          />
                        )}
                        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                          {fmtTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {msg.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
