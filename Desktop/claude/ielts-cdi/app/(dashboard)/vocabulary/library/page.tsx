'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, X, Sparkles, BookOpen, AlertTriangle, Copy, Check, ChevronDown, ChevronUp, ChevronLeft, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Collection { id: string; name: string; created_at: string }
interface Word {
  id: string
  collection_id: string
  word: string
  uzbek_translation: string | null
  definition: string | null
  example: string | null
  extra: { word_type?: string } | null
  source: string
  created_at: string
}

interface EditDraft {
  word: string
  uzbek_translation: string
  word_type: string
  definition: string
  example: string
}

const SETUP_SQL = `create table if not exists public.vocab_collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
alter table public.vocab_collections enable row level security;
create policy "vocab_collections_all" on public.vocab_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.vocab_words (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  collection_id uuid references public.vocab_collections(id) on delete cascade not null,
  word text not null,
  uzbek_translation text,
  definition text,
  example text,
  extra jsonb,
  source text default 'manual',
  created_at timestamptz default now()
);
alter table public.vocab_words enable row level security;
create policy "vocab_words_all" on public.vocab_words
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`

const EMPTY_MANUAL = { word: '', uzbek: '', word_type: '', definition: '', example: '' }

const WORD_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  verb:      { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
  noun:      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  adjective: { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6', border: 'rgba(139,92,246,0.25)' },
  adverb:    { bg: 'rgba(20,184,166,0.12)',  color: '#14b8a6', border: 'rgba(20,184,166,0.25)' },
  phrase:    { bg: 'rgba(244,63,94,0.12)',   color: '#f43f5e', border: 'rgba(244,63,94,0.25)' },
  other:     { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.25)' },
}

const TYPE_OPTIONS = ['verb', 'noun', 'adjective', 'adverb', 'phrase', 'other']

export default function LibraryPage() {
  const { t } = useLanguage()
  const router = useRouter()

  const [collections, setCollections]     = useState<Collection[]>([])
  const [words, setWords]                 = useState<Word[]>([])
  const [loading, setLoading]             = useState(true)
  const [dbMissing, setDbMissing]         = useState(false)
  const [expanded, setExpanded]           = useState<string | null>(null)
  const [newName, setNewName]             = useState('')
  const [creating, setCreating]           = useState(false)
  const [createError, setCreateError]     = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Manual word form
  const [showManual, setShowManual]       = useState(false)
  const [manual, setManual]               = useState(EMPTY_MANUAL)
  const [addingManual, setAddingManual]   = useState(false)
  const [manualError, setManualError]     = useState<string | null>(null)

  // AI generator (state kept for saveGeneratedWord compatibility)
  const [wordInput, setWordInput]         = useState('')
  const [targetCol, setTargetCol]         = useState<string | null>(null)
  const [generating, setGenerating]       = useState(false)
  const [generated, setGenerated]         = useState<Record<string, string> | null>(null)
  const [genError, setGenError]           = useState<string | null>(null)
  const [genNoKey, setGenNoKey]           = useState(false)
  const [saving, setSaving]               = useState(false)
  const [copiedSql, setCopiedSql]         = useState(false)

  // Search & filter
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState('')

  // Inline edit
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editDraft, setEditDraft]         = useState<EditDraft>({ word: '', uzbek_translation: '', word_type: '', definition: '', example: '' })
  const [editSaving, setEditSaving]       = useState(false)
  const [editError, setEditError]         = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setDbMissing(false)
    const [colRes, wordRes] = await Promise.all([
      fetch('/api/vocab/collections'),
      fetch('/api/vocab/words'),
    ])
    if (colRes.status === 503) { setDbMissing(true); setLoading(false); return }
    const cols = colRes.ok  ? await colRes.json()  : []
    const ws   = wordRes.ok ? await wordRes.json() : []
    setCollections(Array.isArray(cols) ? cols : [])
    setWords(Array.isArray(ws) ? ws : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (collections.length > 0 && !expanded) setExpanded(collections[0].id)
  }, [collections.length])

  // Reset manual form when switching collections
  useEffect(() => { setManual(EMPTY_MANUAL); setManualError(null); setShowManual(false); setSearch(''); setTypeFilter('') }, [expanded])

  async function createCollection() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    const res = await fetch('/api/vocab/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const col = await res.json()
      setCollections(prev => [...prev, col])
      setExpanded(col.id)
      setNewName('')
    } else {
      const d = await res.json().catch(() => ({}))
      if (d.error === 'TABLE_NOT_FOUND' || res.status === 503) {
        setDbMissing(true)
      } else {
        setCreateError(d.error ?? `Error ${res.status}`)
      }
    }
    setCreating(false)
  }

  async function deleteCollection(id: string) {
    const res = await fetch(`/api/vocab/collections/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCollections(prev => prev.filter(c => c.id !== id))
      setWords(prev => prev.filter(w => w.collection_id !== id))
      if (expanded === id) setExpanded(null)
    }
    setDeleteConfirm(null)
  }

  async function deleteWord(id: string) {
    const res = await fetch(`/api/vocab/words/${id}`, { method: 'DELETE' })
    if (res.ok) setWords(prev => prev.filter(w => w.id !== id))
  }

  function startEdit(w: Word) {
    setEditingId(w.id)
    setEditDraft({
      word: w.word,
      uzbek_translation: w.uzbek_translation ?? '',
      word_type: w.extra?.word_type ?? '',
      definition: w.definition ?? '',
      example: w.example ?? '',
    })
    setEditError(null)
  }

  async function saveEdit() {
    if (!editingId || !editDraft.word.trim()) return
    setEditSaving(true)
    setEditError(null)
    const res = await fetch(`/api/vocab/words/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: editDraft.word.trim(),
        uzbek_translation: editDraft.uzbek_translation.trim() || null,
        definition: editDraft.definition.trim() || null,
        example: editDraft.example.trim() || null,
        extra: editDraft.word_type.trim() ? { word_type: editDraft.word_type.trim() } : null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setWords(prev => prev.map(w => w.id === editingId ? updated : w))
      setEditingId(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setEditError(d.error ?? 'Xatolik yuz berdi')
    }
    setEditSaving(false)
  }

  async function addManualWord() {
    if (!manual.word.trim() || !manual.uzbek.trim() || !expanded) return
    setAddingManual(true)
    setManualError(null)
    const res = await fetch('/api/vocab/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection_id: expanded,
        word: manual.word.trim(),
        uzbek_translation: manual.uzbek.trim(),
        definition: manual.definition.trim() || null,
        example: manual.example.trim() || null,
        extra: manual.word_type.trim() ? { word_type: manual.word_type.trim() } : null,
        source: 'manual',
      }),
    })
    if (res.ok) {
      const w = await res.json()
      setWords(prev => [w, ...prev])
      setManual(EMPTY_MANUAL)
      setShowManual(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setManualError(d.error ?? 'Xatolik yuz berdi')
    }
    setAddingManual(false)
  }

  async function generateWord() {
    if (!wordInput.trim()) return
    setGenerating(true)
    setGenerated(null)
    setGenError(null)
    setGenNoKey(false)
    const res = await fetch('/api/vocab/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: wordInput.trim() }),
    })
    if (res.ok) {
      setGenerated(await res.json())
    } else {
      const d = await res.json().catch(() => ({}))
      if (d.error === 'NO_API_KEY' || res.status === 503) {
        setGenNoKey(true)
      } else {
        setGenError(d.error ?? 'Generation failed')
      }
    }
    setGenerating(false)
  }

  async function saveGeneratedWord() {
    if (!generated || !targetCol) return
    setSaving(true)
    const res = await fetch('/api/vocab/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection_id: targetCol,
        word: generated.word,
        uzbek_translation: generated.uzbek_translation,
        definition: generated.collocations
          ? `${generated.definition} | Collocations: ${generated.collocations}`
          : generated.definition,
        example: generated.example,
        source: 'ai_generated',
      }),
    })
    if (res.ok) {
      const w = await res.json()
      setWords(prev => [w, ...prev])
      setGenerated(null)
      setWordInput('')
      setExpanded(targetCol)
    }
    setSaving(false)
  }

  function copySQL() {
    navigator.clipboard.writeText(SETUP_SQL)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (dbMissing) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.library')}</span>
          </div>
          <button
            onClick={() => router.push('/vocabulary')}
            className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} /> Vocabulary ga qaytish
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>📖 {t('vocabulary.library')}</h1>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <div className="flex items-center gap-2 font-semibold mb-2" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={18} /> {t('vocabulary.tableMissing')}
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.tableMissingDesc')}</p>
          <pre className="text-xs p-4 rounded-lg overflow-x-auto mb-3"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            {SETUP_SQL}
          </pre>
          <div className="flex gap-2">
            <button onClick={copySQL} className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: 'var(--accent)', color: 'white' }}>
              {copiedSql ? <><Check size={14} /> {t('vocabulary.copied')}</> : <><Copy size={14} /> {t('vocabulary.copySql')}</>}
            </button>
            <button onClick={loadAll} className="text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {t('vocabulary.retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const activeCol = collections.find(c => c.id === expanded)
  const colWords  = words.filter(w => w.collection_id === expanded)
  const filteredWords = colWords.filter(w => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q ||
      w.word.toLowerCase().includes(q) ||
      (w.uzbek_translation ?? '').toLowerCase().includes(q)
    const matchType = !typeFilter || (w.extra?.word_type ?? '') === typeFilter
    return matchSearch && matchType
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vocabulary" className="hover:underline">{t('vocabulary.title')}</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{t('vocabulary.library')}</span>
        </div>
        <button
          onClick={() => router.push('/vocabulary')}
          className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} /> Vocabulary ga qaytish
        </button>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>📖 {t('vocabulary.library')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('vocabulary.libraryDesc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Collections list ── */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            {t('vocabulary.collections')} ({collections.length})
          </h2>

          {/* Create new collection */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => { setNewName(e.target.value); setCreateError(null) }}
              onKeyDown={e => e.key === 'Enter' && createCollection()}
              placeholder={t('vocabulary.newCollection')}
              className="input-field text-sm flex-1 py-2"
            />
            <button onClick={createCollection} disabled={creating || !newName.trim()}
              className="btn-primary px-3 py-2 disabled:opacity-50">
              {creating
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Plus size={16} />}
            </button>
          </div>

          {createError && (
            <p className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {createError}
            </p>
          )}

          {collections.length === 0 ? (
            <div className="py-8 text-center rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <BookOpen size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('vocabulary.noCollections')}<br />{t('vocabulary.createOne')}</p>
            </div>
          ) : (
            collections.map(col => {
              const wc = words.filter(w => w.collection_id === col.id).length
              const isExp = expanded === col.id
              return (
                <div key={col.id}>
                  <button
                    onClick={() => setExpanded(isExp ? null : col.id)}
                    className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                    style={{
                      background: isExp ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                      border: `1px solid ${isExp ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>📁</span>
                      <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                      <span className="text-xs shrink-0 px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        {wc}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {deleteConfirm === col.id ? (
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => deleteCollection(col.id)}
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: 'var(--error)', color: 'white' }}>
                            {t('vocabulary.delete')}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ color: 'var(--text-muted)' }}>
                            {t('vocabulary.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDeleteConfirm(col.id) }}
                          className="p-1 rounded" style={{ color: 'var(--error)' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                      {isExp ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* ── Right: Word list + forms ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Collection word list */}
          {activeCol ? (
            <div>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
                📁 {activeCol.name} — {t('vocabulary.wordCount').replace('{count}', String(colWords.length))}
              </h2>

              {/* ── Search & type filter ── */}
              {colWords.length > 0 && (
                <div className="mb-3 space-y-2">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="So'z qidirish..."
                    className="input-field w-full text-sm py-2"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {['', ...TYPE_OPTIONS].map(type => (
                      <button
                        key={type || '_all'}
                        onClick={() => setTypeFilter(type)}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
                        style={typeFilter === type
                          ? { background: type ? WORD_TYPE_COLORS[type]?.bg ?? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.15)', color: type ? WORD_TYPE_COLORS[type]?.color ?? 'var(--accent)' : 'var(--accent)', border: `1px solid ${type ? WORD_TYPE_COLORS[type]?.border ?? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.3)'}` }
                          : { background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
                        }
                      >
                        {type || 'Barchasi'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Manual add form ── */}
              <div className="mb-3 rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <button
                  onClick={() => { setShowManual(v => !v); setManualError(null) }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
                  style={{ color: showManual ? 'var(--accent)' : 'var(--text-primary)', background: showManual ? 'rgba(99,102,241,0.06)' : 'transparent' }}
                >
                  <span className="flex items-center gap-2">
                    <Plus size={15} style={{ color: 'var(--accent)' }} /> {t('vocabulary.addWord')}
                  </span>
                  {showManual ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
                </button>

                {showManual && (
                  <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="pt-3 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={manual.word}
                        onChange={e => setManual(p => ({ ...p, word: e.target.value }))}
                        placeholder={t('vocabulary.wordEn')}
                        className="input-field text-sm py-2"
                      />
                      <input
                        type="text"
                        value={manual.uzbek}
                        onChange={e => setManual(p => ({ ...p, uzbek: e.target.value }))}
                        placeholder={t('vocabulary.wordUz')}
                        className="input-field text-sm py-2"
                      />
                    </div>
                    <select
                      value={manual.word_type}
                      onChange={e => setManual(p => ({ ...p, word_type: e.target.value }))}
                      className="input-field w-full text-sm py-2"
                    >
                      <option value="">So&apos;z turi (ixtiyoriy)</option>
                      <option value="noun">noun</option>
                      <option value="verb">verb</option>
                      <option value="adjective">adjective</option>
                      <option value="adverb">adverb</option>
                      <option value="phrase">phrase</option>
                      <option value="other">other</option>
                    </select>
                    <input
                      type="text"
                      value={manual.definition}
                      onChange={e => setManual(p => ({ ...p, definition: e.target.value }))}
                      placeholder={t('vocabulary.wordDef')}
                      className="input-field w-full text-sm py-2"
                    />
                    <input
                      type="text"
                      value={manual.example}
                      onChange={e => setManual(p => ({ ...p, example: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addManualWord()}
                      placeholder={t('vocabulary.wordEx')}
                      className="input-field w-full text-sm py-2"
                    />
                    {manualError && (
                      <p className="text-xs" style={{ color: 'var(--error)' }}>{manualError}</p>
                    )}
                    <button
                      onClick={addManualWord}
                      disabled={addingManual || !manual.word.trim() || !manual.uzbek.trim()}
                      className="btn-primary text-sm px-4 py-2 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {addingManual
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : null}
                      {t('vocabulary.addWordBtn')}
                    </button>
                  </div>
                )}
              </div>

              {/* Word list */}
              {colWords.length === 0 ? (
                <div className="py-10 text-center rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('vocabulary.noWords')}</p>
                </div>
              ) : filteredWords.length === 0 ? (
                <div className="py-8 text-center rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <p className="text-sm">Hech narsa topilmadi</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredWords.map(w => (
                    <div key={w.id}
                      className="rounded-xl p-4 group transition-all"
                      style={{
                        background: editingId === w.id ? 'var(--bg-secondary)' : 'var(--bg-card)',
                        border: `1px solid ${editingId === w.id ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                      onMouseEnter={e => { if (editingId !== w.id) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)' }}
                      onMouseLeave={e => { if (editingId !== w.id) e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      {editingId === w.id ? (
                        /* ── Inline edit mode ── */
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>So&apos;z</label>
                              <input
                                type="text"
                                value={editDraft.word}
                                onChange={e => setEditDraft(p => ({ ...p, word: e.target.value }))}
                                className="input-field text-sm py-1.5 w-full"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Tarjima</label>
                              <input
                                type="text"
                                value={editDraft.uzbek_translation}
                                onChange={e => setEditDraft(p => ({ ...p, uzbek_translation: e.target.value }))}
                                className="input-field text-sm py-1.5 w-full"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>So&apos;z turi</label>
                            <select
                              value={editDraft.word_type}
                              onChange={e => setEditDraft(p => ({ ...p, word_type: e.target.value }))}
                              className="input-field text-sm py-1.5 w-full"
                            >
                              <option value="">— tanlang —</option>
                              <option value="noun">noun</option>
                              <option value="verb">verb</option>
                              <option value="adjective">adjective</option>
                              <option value="adverb">adverb</option>
                              <option value="phrase">phrase</option>
                              <option value="idiom">idiom</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Ta&apos;rif</label>
                            <textarea
                              value={editDraft.definition}
                              onChange={e => setEditDraft(p => ({ ...p, definition: e.target.value }))}
                              rows={2}
                              className="input-field text-sm py-1.5 w-full resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Misol gap</label>
                            <textarea
                              value={editDraft.example}
                              onChange={e => setEditDraft(p => ({ ...p, example: e.target.value }))}
                              rows={2}
                              className="input-field text-sm py-1.5 w-full resize-none"
                            />
                          </div>
                          {editError && (
                            <p className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--error)' }}>{editError}</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={saveEdit}
                              disabled={editSaving || !editDraft.word.trim()}
                              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {editSaving
                                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Check size={13} />}
                              Saqlash
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditError(null) }}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium"
                              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                            >
                              Bekor qilish
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── View mode ── */
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap mb-1.5">
                              <span className="font-bold text-base" style={{ color: 'var(--accent)' }}>{w.word}</span>
                              {w.uzbek_translation && (
                                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>— {w.uzbek_translation}</span>
                              )}
                              {w.extra?.word_type && (() => {
                                const c = WORD_TYPE_COLORS[w.extra.word_type] ?? WORD_TYPE_COLORS.other
                                return (
                                  <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                                    style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                                    {w.extra.word_type}
                                  </span>
                                )
                              })()}
                              {w.source === 'ai_generated' && (
                                <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5"
                                  style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                  <Sparkles size={9} /> AI
                                </span>
                              )}
                              {w.source === 'irregular_verb' && !w.extra?.word_type && (
                                <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                                  style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                                  verb
                                </span>
                              )}
                            </div>
                            {w.definition && (
                              <p className="text-xs leading-relaxed mb-1" style={{ color: 'var(--text-muted)' }}>{w.definition}</p>
                            )}
                            {w.example && (
                              <p className="text-xs italic px-2 py-1 rounded-lg"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                                &ldquo;{w.example}&rdquo;
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <button
                              onClick={() => startEdit(w)}
                              className="p-1.5 rounded-lg transition-all"
                              style={{ color: 'var(--accent)', background: 'transparent' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteWord(w.id)}
                              className="p-1.5 rounded-lg transition-all"
                              style={{ color: 'var(--error)', background: 'transparent' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : collections.length > 0 ? (
            <div className="py-10 text-center rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <p className="text-sm">{t('vocabulary.selectCollection')}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
