'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ChevronLeft, Upload } from 'lucide-react'

const ADMIN_EMAILS = ['abdulxdiymamajonov@gmail.com', 'otabekmuminov0427@gmail.com']

interface Dictation {
  id: number
  title: string
  description: string | null
  audio_url: string
  transcript: string
  order_index: number
  difficulty: 'easy' | 'medium' | 'hard'
  is_premium: boolean
  duration_seconds: number | null
}

const BLANK: Omit<Dictation, 'id'> = {
  title: '',
  description: '',
  audio_url: '',
  transcript: '',
  order_index: 1,
  difficulty: 'medium',
  is_premium: false,
  duration_seconds: null,
}

export default function AdminDictationsPage() {
  const router = useRouter()
  const [ready,      setReady]      = useState(false)
  const [dictations, setDictations] = useState<Dictation[]>([])
  const [editing,    setEditing]    = useState<Partial<Dictation> | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [deleteId,   setDeleteId]   = useState<number | null>(null)

  useEffect(() => {
    async function init() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
        router.replace('/dashboard')
        return
      }
      await reload()
      setReady(true)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reload() {
    const res = await fetch('/api/admin/dictations')
    if (res.ok) setDictations(await res.json())
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      if (editing.id) {
        await fetch(`/api/admin/dictations/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        })
      } else {
        await fetch('/api/admin/dictations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        })
      }
      await reload()
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/admin/dictations/${id}`, { method: 'DELETE' })
    await reload()
    setDeleteId(null)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editing) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/dictations/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url } = await res.json()
        setEditing(prev => ({ ...prev, audio_url: url }))
      }
    } finally {
      setUploading(false)
    }
  }

  if (!ready) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div
      className="max-w-4xl mx-auto px-4 py-8"
      style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/admin')}
          className="p-2 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          ✍️ Diktantlar
        </h1>
        <div className="flex-1" />
        <button
          onClick={() => setEditing({ ...BLANK, order_index: dictations.length + 1 })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Qo&apos;shish
        </button>
      </div>

      {/* List */}
      <div className="grid gap-3">
        {dictations.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            Hali diktantlar yo&apos;q
          </p>
        )}
        {dictations.map(d => (
          <div key={d.id} className="card p-4 flex items-center gap-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              {d.order_index}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {d.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {d.difficulty} · {d.is_premium ? 'Premium' : 'Bepul'} ·{' '}
                {d.audio_url ? '🎵 Audio bor' : '⚠️ Audio yo\'q'}
                {d.duration_seconds ? ` · ${Math.round(d.duration_seconds / 60)} min` : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setEditing(d)}
                className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                style={{ color: 'var(--accent)' }}
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setDeleteId(d.id)}
                className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={() => setEditing(null)}
          />
          <div
            className="relative card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ zIndex: 51 }}
          >
            <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
              {editing.id ? 'Tahrirlash' : 'Yangi diktant'}
            </h2>

            <div className="grid gap-4">
              {/* Title */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  Sarlavha *
                </label>
                <input
                  value={editing.title ?? ''}
                  onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  Tavsif (ixtiyoriy)
                </label>
                <input
                  value={editing.description ?? ''}
                  onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />
              </div>

              {/* Audio URL + upload */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  Audio fayl *
                </label>
                <div className="flex gap-2">
                  <input
                    value={editing.audio_url ?? ''}
                    onChange={e => setEditing(p => ({ ...p, audio_url: e.target.value }))}
                    placeholder="URL yoki yuklang..."
                    className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                  <label
                    className="btn-outline text-sm cursor-pointer flex items-center gap-1.5 px-3 py-2 shrink-0"
                    style={{ opacity: uploading ? 0.6 : 1 }}
                  >
                    {uploading ? '...' : <><Upload size={14} /> MP3</>}
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={handleUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
                {editing.audio_url && (
                  <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>✓ Audio URL saqlandi</p>
                )}
              </div>

              {/* Transcript */}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  Matn — to&apos;g&apos;ri javob *
                </label>
                <textarea
                  value={editing.transcript ?? ''}
                  onChange={e => setEditing(p => ({ ...p, transcript: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />
              </div>

              {/* order / difficulty / duration */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
                    Tartib
                  </label>
                  <input
                    type="number"
                    value={editing.order_index ?? 1}
                    onChange={e => setEditing(p => ({ ...p, order_index: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
                    Qiyinlik
                  </label>
                  <select
                    value={editing.difficulty ?? 'medium'}
                    onChange={e => setEditing(p => ({ ...p, difficulty: e.target.value as 'easy' | 'medium' | 'hard' }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
                    Davomiyligi (s)
                  </label>
                  <input
                    type="number"
                    value={editing.duration_seconds ?? ''}
                    onChange={e =>
                      setEditing(p => ({
                        ...p,
                        duration_seconds: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                    placeholder="360"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              {/* Premium toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editing.is_premium ?? false}
                  onChange={e => setEditing(p => ({ ...p, is_premium: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Premium</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              <button onClick={() => setEditing(null)} className="btn-outline">
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.75)' }}
            onClick={() => setDeleteId(null)}
          />
          <div
            className="relative card p-6 w-full max-w-sm text-center"
            style={{ zIndex: 51 }}
          >
            <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Diktantni o&apos;chirish?
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Bu amalni qaytarib bo&apos;lmaydi.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn-primary flex-1"
                style={{ background: '#ef4444', boxShadow: 'none' }}
              >
                O&apos;chirish
              </button>
              <button onClick={() => setDeleteId(null)} className="btn-outline flex-1">
                Bekor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
