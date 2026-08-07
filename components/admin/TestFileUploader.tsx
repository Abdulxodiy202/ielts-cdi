'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, Loader2, CheckCircle, X, Trash2 } from 'lucide-react'

interface Test {
  id: string
  title: string
  file_url: string | null
  order_number: number
}

interface Props {
  type: 'reading' | 'listening'
  tests: Test[]
  accept: string
}

export function TestFileUploader({ type, tests, accept }: Props) {
  const [selectedTestId, setSelectedTestId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  // Track uploaded URLs per test locally so UI updates instantly
  // null means "deleted locally" — overrides DB value
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string | null>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedTest = tests.find(t => t.id === selectedTestId) ?? null
  // If uploadedUrls has an explicit entry (string = new upload, null = deleted), use it; else fall back to DB value
  const currentUrl = selectedTestId in uploadedUrls
    ? uploadedUrls[selectedTestId]
    : (selectedTest?.file_url ?? null)
  const currentFileName = currentUrl ? decodeURIComponent(currentUrl.split('/').pop()?.split('?')[0] ?? '') : null

  const handleTestChange = (testId: string) => {
    setSelectedTestId(testId)
    setSelectedFile(null)
    setMessage(null)
    setShowDeleteConfirm(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setMessage(null)
  }

  const handleSave = async () => {
    if (!selectedTestId || !selectedFile) return
    setSaving(true)
    setMessage(null)

    try {
      // Step 1: Ask the server for a signed upload URL (tiny JSON request — no file bytes)
      const urlRes = await fetch('/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: selectedTestId, fileName: selectedFile.name }),
      })
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'URL olishda xato')
      }
      const { signedUrl, contentType, publicUrl } = await urlRes.json()

      // Step 2: PUT the file directly to Supabase Storage — bypasses Vercel's 4.5 MB limit
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: selectedFile,
      })
      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => '')
        throw new Error(`Storage xatosi ${uploadRes.status}${text ? ': ' + text.slice(0, 120) : ''}`)
      }

      // Step 3: Update the DB record with the public URL
      const recordRes = await fetch('/api/admin/test-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: selectedTestId, publicUrl, fileName: selectedFile.name }),
      })
      if (!recordRes.ok) {
        const err = await recordRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'DB yangilashda xato')
      }

      const { url } = await recordRes.json()
      setUploadedUrls(prev => ({ ...prev, [selectedTestId]: url }))
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMessage({ ok: true, text: 'Fayl muvaffaqiyatli yuklandi!' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Xatolik yuz berdi' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTestId || !currentFileName) return
    setDeleting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/test-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: selectedTestId, fileName: currentFileName }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "O'chirish xatosi")
      }
      // Mark as deleted locally
      setUploadedUrls(prev => ({ ...prev, [selectedTestId]: null }))
      setShowDeleteConfirm(false)
      setMessage({ ok: true, text: "Fayl muvaffaqiyatli o'chirildi!" })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Xatolik yuz berdi' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* Test selector */}
      <div className="card p-4">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          {type === 'reading' ? 'Reading' : 'Listening'} Test tanlang
        </label>
        <select
          value={selectedTestId}
          onChange={e => handleTestChange(e.target.value)}
          className="input-field"
        >
          <option value="">— Test tanlang —</option>
          {tests.map(t => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>

      {/* Upload area — only show after test selected */}
      {selectedTestId && (
        <div className="card p-5 space-y-4">
          {/* Current file */}
          {currentFileName && (
            <div className="space-y-2">
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Joriy fayl:
                  </p>
                  <a
                    href={currentUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm truncate block hover:underline"
                    style={{ color: 'var(--success)' }}
                  >
                    {currentFileName}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(true); setMessage(null) }}
                  disabled={deleting}
                  title="Faylni o'chirish"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors shrink-0"
                  style={{
                    color: 'var(--error)',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <Trash2 size={13} />
                  <span>O&apos;chirish</span>
                </button>
              </div>

              {/* Inline confirmation */}
              {showDeleteConfirm && (
                <div
                  className="flex items-center justify-between gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>
                    Haqiqatan ham o&apos;chirilsinmi?
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      Bekor
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: 'var(--error)', color: '#fff', opacity: deleting ? 0.7 : 1 }}
                    >
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      {deleting ? 'O\'chirilmoqda…' : 'Ha, o\'chirish'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File picker */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              {currentFileName ? 'Yangi fayl bilan almashtirish:' : 'Fayl yuklash:'}
            </p>

            <div
              className="relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl cursor-pointer transition-all"
              style={{
                border: `2px dashed ${selectedFile ? 'var(--accent)' : 'var(--border)'}`,
                background: selectedFile ? 'rgba(99,102,241,0.05)' : 'var(--bg-secondary)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <>
                  <FileText size={28} style={{ color: 'var(--accent)' }} />
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {selectedFile.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="absolute top-2 right-2 p-1 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <Upload size={22} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      CDI Test faylini yuklash
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {accept.split(',').join(', ')} formatlar qabul qilinadi
                    </p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className="p-3 rounded-xl text-sm font-medium"
              style={{
                background: message.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: message.ok ? 'var(--success)' : 'var(--error)',
                border: `1px solid ${message.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}
            >
              {message.ok ? '✅' : '❌'} {message.text}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!selectedFile || saving}
            className="btn-primary w-full flex items-center justify-center gap-2"
            style={{
              opacity: !selectedFile || saving ? 0.5 : 1,
              cursor: !selectedFile || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> Yuklanmoqda…</>
            ) : (
              <><Upload size={16} /> Saqlash</>
            )}
          </button>
        </div>
      )}

      {!selectedTestId && (
        <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
          Yuqoridan test raqamini tanlang
        </div>
      )}
    </div>
  )
}
