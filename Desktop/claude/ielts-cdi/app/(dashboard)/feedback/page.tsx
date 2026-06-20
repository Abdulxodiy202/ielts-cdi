'use client'

import { useState } from 'react'
import { MessageSquarePlus, Send, CheckCircle } from 'lucide-react'

export default function FeedbackPage() {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })
      if (res.ok) {
        setSent(true)
        setMessage('')
        setTimeout(() => setSent(false), 5000)
      } else {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? 'Xatolik yuz berdi')
      }
    } catch {
      setError('Tarmoq xatosi')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <MessageSquarePlus size={26} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
            Feedback bering, chegirma oling
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Foydali fikr yoki xatoliklarni ayting — chegirma yutib oling
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
        >
          <label className="block text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Adminga xat
          </label>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
            }}
            placeholder="Sayt haqidagi fikringizni, topgan xatolaringizni yoki takliflaringizni shu yerga yozing..."
            rows={6}
            className="input-field w-full resize-none text-sm leading-relaxed"
            disabled={sending}
          />

          {error && (
            <p className="text-sm" style={{ color: 'var(--error)' }}>
              ❌ {error}
            </p>
          )}

          {sent && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: 'var(--success)' }}
            >
              <CheckCircle size={16} />
              Yuborildi! Admin 24 soat ichida javob beradi.
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 font-semibold disabled:opacity-50 transition-opacity"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Yuborilmoqda...
              </>
            ) : (
              <>
                <Send size={15} />
                Yuborish
              </>
            )}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Ctrl + Enter bilan ham yuborish mumkin
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          {[
            { emoji: '🐛', title: 'Xato topding?', desc: 'Test, audio yoki saytdagi muammo haqida yozing' },
            { emoji: '💡', title: 'Taklif bor?', desc: 'Yangi funksiya yoki yaxshilash g\'oyalarini ulashing' },
          ].map(item => (
            <div
              key={item.title}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <div className="text-2xl mb-2">{item.emoji}</div>
              <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
